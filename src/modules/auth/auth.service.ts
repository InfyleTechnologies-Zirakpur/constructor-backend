import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity.js';
import { DeviceToken } from '../notifications/entities/device-token.entity.js';
import type { LoginUserDto } from './dto/login-user.dto.js';
import type { RegisterUserDto } from './dto/register-user.dto.js';
import type { RequestOtpDto } from './dto/request-otp.dto.js';
import type { VerifyOtpDto } from './dto/verify-otp.dto.js';
import type { ResetPasswordDto } from './dto/reset-password.dto.js';
import type { RefreshTokenDto } from './dto/refresh-token.dto.js';
import type { UserRole } from '../../common/types/role.enum.js';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(DeviceToken)
    private readonly deviceTokenRepo: Repository<DeviceToken>,
  ) {}

  private async generateTokens(user: User) {
    const payload = {
      sub: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role as UserRole,
      employeeId: (user as any).employeeId ?? null,
      policy: (user as any).policy ?? null,
      verified: !!(user as any).isVerified,
      blocked: !!(user as any).isBlocked,
      emailVerified: !!(user as any).emailVerified,
      phoneVerified: !!(user as any).phoneVerified,
      ver: (user as any).tokenVersion ?? 0,
    };

    const expiresIn = this.configService?.get<string>('JWT_EXPIRES_IN') || '7d';
    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: expiresIn as any,
    });
    const refreshToken = randomBytes(40).toString('hex');
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

    user.refreshTokenHash = refreshTokenHash;
    user.lastLoginAt = new Date();
    const currentLoginCount = Number((user as any).loginCount) || 0;
    user.loginCount =
      (currentLoginCount < 0 || currentLoginCount > 1000000000
        ? 0
        : currentLoginCount) + 1;
    user.failedLoginAttempts = 0;
    user.lockoutUntil = null;
    await this.userRepository.save(user);

    return {
      accessToken,
      refreshToken,
      expiresIn: 604800, // 7 days in seconds
    };
  }

  /**
   * Build the "worker" profile object that the Flutter app expects.
   * Shape: { id, name, phone, city, skills, profilePhotoUrl, documents, salaryExpectation }
   */
  private buildWorkerProfile(user: User) {
    const complete = this.isWorkerProfileComplete(user);
    return {
      id: user.id,
      employeeId: (user as any).employeeId ?? null,
      name: user.fullName,
      email: user.email,
      phone: user.phone ?? '',
      role: user.role,
      verified: !!(user as any).isVerified,
      blocked: !!(user as any).isBlocked,
      city: (user as any).city ?? '',
      skills: (user as any).skills ?? [],
      profilePhotoUrl: user.avatarUrl ?? null,
      documents: (user as any).documents ?? [],
      salaryExpectation: (user as any).salaryExpectation ?? '',
      policy: (user as any).policy ?? null,
      // Explicit flags so Flutter can route correctly without guessing.
      isNewUser: !complete,
      isProfileComplete: complete,
    };
  }

  /**
   * Single source of truth for "has this phone number finished
   * Create Profile?".
   *
   * requestOtp auto-creates every unknown phone with
   * fullName='Job Seeker' + empty city/skills — that placeholder must
   * NOT count as a complete profile, otherwise a brand-new number
   * (e.g. 1234567891) lands straight on HomePage.
   */
  private isWorkerProfileComplete(user: User): boolean {
    const rawName = (user.fullName ?? '').trim();
    const lower = rawName.toLowerCase();
    const PLACEHOLDERS = new Set([
      '',
      'null',
      'undefined',
      'job seeker',
      'jobseeker',
      'new user',
      'user',
    ]);
    if (PLACEHOLDERS.has(lower)) return false;
    // Auto-generated synthetic email means profile was never filled.
    const email = (user.email ?? '').toLowerCase();
    const isSyntheticEmail =
      email.endsWith('@buildhire.app') &&
      email.startsWith((user.phone ?? '').toLowerCase());
    // Real (non-synthetic) registration with a real name → complete,
    // even if city/skills were skipped.
    if (!isSyntheticEmail) return true;
    // Synthetic OTP auto-account: require at least one real profile field
    // (city / skills / salary) beyond the 'Job Seeker' placeholder.
    const city = ((user as any).city ?? '').toString().trim();
    const skills = (user as any).skills as unknown;
    const salary = ((user as any).salaryExpectation ?? '').toString().trim();
    const hasCity = city !== '' && city.toLowerCase() !== 'null';
    const hasSkills = Array.isArray(skills) && skills.length > 0;
    const hasSalary = salary !== '' && salary.toLowerCase() !== 'null';
    if (isSyntheticEmail && !hasCity && !hasSkills && !hasSalary) return false;
    if (!hasCity && !hasSkills && !hasSalary) return false;
    return true;
  }

  // ════════════════════════════════════════════════════
  //  PHONE + OTP AUTH (Flutter App Flow)
  // ════════════════════════════════════════════════════

  /**
   * POST /auth/request-otp
   * Flutter sends: { "phone": "9876543210" }
   * Returns: { "otpSent": true, "message": "OTP sent successfully" }
   */
  async requestOtp(dto: RequestOtpDto) {
    // Find user by phone
    let user = await this.userRepository.findOne({
      where: { phone: dto.phone },
    });

    // Track whether this phone is brand-new BEFORE auto-register.
    // Flutter uses this to decide Create-Profile vs Home — but the
    // authoritative check happens in verifyOtp (profile completeness),
    // because requestOtp can be called multiple times.
    const isNewUser = !user;

    // Auto-register if user doesn't exist (first-time job seeker)
    if (!user) {
      const defaultPassword = await bcrypt.hash(
        randomBytes(16).toString('hex'),
        10,
      );
      user = this.userRepository.create({
        fullName: 'Job Seeker',
        email: `${dto.phone}@buildhire.app`,
        phone: dto.phone,
        passwordHash: defaultPassword,
        role: 'job_seeker',
      });
      user = await this.userRepository.save(user);
      this.logger.log(
        `Auto-registered new job seeker with phone: ${dto.phone}`,
      );
    }

    // NOTE: SMS now via Firebase Phone Auth (client SDK) — this endpoint kept for dev fallback.
    // In Firebase flow, client calls Firebase SDK directly, so this is not used.
    // We still generate a dev OTP for curl testing when Firebase not used.
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 10);

    // Expires in 10 minutes
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    user.otpHash = otpHash;
    user.otpExpiresAt = expiresAt;
    await this.userRepository.save(user);

    // Firebase will send SMS in prod — only log OTP in non-production environments
    if (process.env.NODE_ENV !== 'production') {
      this.logger.debug(`[DEV] OTP for ${dto.phone}: ${otp}`);
    }

    return {
      otpSent: true,
      message:
        'OTP sent successfully — use Firebase Phone Auth in app, dev OTP in log',
      isNewUser,
      phone: dto.phone,
    };
  }

  /**
   * POST /auth/verify-otp
   * Flutter sends: { "phone": "9876543210", "otp": "123456" }
   * Returns: { accessToken, expiresIn, worker: {...} }
   */
  async verifyOtp(dto: VerifyOtpDto) {
    // ── Firebase path: otp field contains Firebase ID token (JWT) OR dto.idToken
    const maybeToken = (dto as any).idToken ?? dto.otp;
    const looksLikeFirebaseJwt =
      typeof maybeToken === 'string' &&
      maybeToken.includes('.') &&
      maybeToken.length > 200;

    if (looksLikeFirebaseJwt) {
      try {
        const { getAuth } = await import('firebase-admin/auth');
        const decoded = await getAuth().verifyIdToken(maybeToken);
        const firebasePhone: string | undefined = (decoded as any).phone_number;
        // Firebase phone is like +919876543210 — normalize to 10 digits
        const normalizedPhone =
          firebasePhone?.replace(/^\+91/, '').replace(/^\+/, '').slice(-10) ??
          dto.phone;
        const phoneToUse = normalizedPhone || dto.phone;

        let user = await this.userRepository.findOne({
          where: { phone: phoneToUse },
        });
        if (!user) {
          // Auto-create seeker from Firebase phone (same as requestOtp auto-register)
          const defaultPassword = await bcrypt.hash(
            randomBytes(16).toString('hex'),
            10,
          );
          const newUser = this.userRepository.create({
            fullName: 'Job Seeker',
            email: `${phoneToUse}@buildhire.app`,
            phone: phoneToUse,
            passwordHash: defaultPassword,
            role: 'job_seeker',
            phoneVerified: true,
          } as any);
          const savedF = await this.userRepository.save(
            newUser as unknown as User,
          );
          user = Array.isArray(savedF) ? (savedF[0] as User) : (savedF as User);
          this.logger.log(`Auto-registered via Firebase phone: ${phoneToUse}`);
        }

        if (!user) throw new BadRequestException('Firebase user not found');
        if ((user as any).isBlocked) {
          throw new UnauthorizedException('Account is blocked');
        }

        (user as any).phoneVerified = true;
        const currentVersionFb = Number((user as any).tokenVersion) || 0;
        (user as any).tokenVersion =
          (currentVersionFb < 0 || currentVersionFb > 1000000000
            ? 0
            : currentVersionFb) + 1;
        (user as any).otpHash = null;
        (user as any).otpExpiresAt = null;
        await this.userRepository.save(user as User);

        const tokens = await this.generateTokens(user as User);
        const worker = this.buildWorkerProfile(user!);
        const isProfileComplete = this.isWorkerProfileComplete(user!);
        return {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: 604800,
          worker,
          // Top-level flags — Flutter checks these FIRST.
          isNewUser: !isProfileComplete,
          isProfileComplete,
        };
      } catch (e: any) {
        // If Firebase verify fails, fall through to custom OTP check
        this.logger.warn(
          `Firebase verify failed, falling back to custom OTP: ${e?.message}`,
        );
      }
    }

    const user = await this.userRepository.findOne({
      where: { phone: dto.phone },
    });

    if (!user || !user.otpHash || !user.otpExpiresAt) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    if ((user as any).isBlocked) {
      throw new UnauthorizedException('Account is blocked');
    }

    if (new Date() > user.otpExpiresAt) {
      throw new BadRequestException('OTP has expired');
    }

    const isOtpValid = await bcrypt.compare(dto.otp, user.otpHash);
    if (!isOtpValid) {
      throw new BadRequestException('Invalid OTP');
    }

    // Single-session: bump tokenVersion to kick old devices
    const currentVersionOtp = Number((user as any).tokenVersion) || 0;
    (user as any).tokenVersion =
      (currentVersionOtp < 0 || currentVersionOtp > 1000000000
        ? 0
        : currentVersionOtp) + 1;
    // Mark phone verified on successful OTP
    (user as any).phoneVerified = true;
    // Clear OTP after successful verification
    user.otpHash = null;
    user.otpExpiresAt = null;
    await this.userRepository.save(user);

    const tokens = await this.generateTokens(user);

    const worker = this.buildWorkerProfile(user);
    const isProfileComplete = this.isWorkerProfileComplete(user);
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: 604800, // 7 days in seconds
      worker,
      // Top-level flags — Flutter checks these FIRST.
      // New number (e.g. 1234567891, auto-created with 'Job Seeker'
      // placeholder) → isNewUser=true → Create Profile screen.
      // Existing number with saved name/city/skills → HomePage.
      isNewUser: !isProfileComplete,
      isProfileComplete,
    };
  }

  /**
   * POST /auth/reset-password
   * Flutter sends: { "phone": "9876543210", "otp": "123456", "newPassword": "..." }
   * Returns: { changed: true }
   */
  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.userRepository.findOne({
      where: { phone: dto.phone },
    });

    if (!user || !user.otpHash || !user.otpExpiresAt) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    if (new Date() > user.otpExpiresAt) {
      throw new BadRequestException('OTP has expired');
    }

    const isOtpValid = await bcrypt.compare(dto.otp, user.otpHash);
    if (!isOtpValid) {
      throw new BadRequestException('Invalid OTP');
    }

    user.passwordHash = await bcrypt.hash(dto.newPassword, 10);
    user.otpHash = null;
    user.otpExpiresAt = null;
    user.refreshTokenHash = null;

    await this.userRepository.save(user);

    return { changed: true };
  }

  // ════════════════════════════════════════════════════
  //  EMAIL + PASSWORD AUTH (Admin / Contractor Panel)
  // ════════════════════════════════════════════════════

  async register(dto: RegisterUserDto) {
    // Public self-registration: job_seeker (OTP/auto) + company + contractor
    // self-register per docs §4.1 ("Contractor registration/profile...").
    // Site engineers are created by their contractor (POST /site-engineers);
    // admin accounts are seeded, never self-registered.
    const SELF_REGISTER_ALLOWED: string[] = [
      'job_seeker',
      'company',
      'contractor',
    ];
    if (!SELF_REGISTER_ALLOWED.includes(dto.role)) {
      throw new BadRequestException(
        `Role '${dto.role}' cannot be self-registered. Contact an administrator.`,
      );
    }

    if (dto.email) {
      const existingUser = await this.userRepository.findOne({
        where: { email: dto.email },
      });
      if (existingUser) {
        throw new ConflictException('Email already registered');
      }
    }
    if (dto.phone) {
      const existingPhone = await this.userRepository.findOne({
        where: { phone: dto.phone },
      });
      if (existingPhone) {
        throw new ConflictException('Phone already registered');
      }
    }

    const passwordHash = dto.password
      ? await bcrypt.hash(dto.password, 10)
      : null;
    const user = this.userRepository.create({
      fullName: dto.fullName,
      email: dto.email ?? null,
      phone: dto.phone ?? null,
      passwordHash,
      role: dto.role,
      employeeId: (dto as any).employeeId ?? null,
      policy: (dto as any).policy ?? null,
      isVerified: false,
      isBlocked: false,
      emailVerified: false,
      phoneVerified: false,
    } as any);

    const saved = await this.userRepository.save(user);
    const savedUser = Array.isArray(saved) ? saved[0] : saved;
    const tokens = await this.generateTokens(savedUser as User);

    return {
      user: {
        id: savedUser.id,
        employeeId: (savedUser as any).employeeId ?? null,
        fullName: savedUser.fullName,
        email: savedUser.email,
        phone: savedUser.phone,
        role: savedUser.role,
        isVerified: (savedUser as any).isVerified,
        isBlocked: (savedUser as any).isBlocked,
        policy: (savedUser as any).policy ?? null,
        createdAt: savedUser.createdAt,
      },
      ...tokens,
    };
  }

  async login(dto: LoginUserDto) {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    // Use the same generic error for both user-not-found and wrong password
    // to prevent username enumeration.
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if ((user as any).isBlocked) {
      throw new UnauthorizedException('Account is blocked');
    }
    if (!(user as any).isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }
    if ((user as any).lockoutUntil && new Date() < (user as any).lockoutUntil) {
      throw new UnauthorizedException('Account is locked. Try later');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('Password not set. Use OTP login');
    }
    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash as string,
    );
    if (!isPasswordValid) {
      const attempts = Number((user as any).failedLoginAttempts) || 0;
      // Sanitize corrupted/overflowed value from previous string concatenations (>20 digits)
      const safeAttempts = attempts < 0 || attempts > 20 ? 0 : attempts;
      user.failedLoginAttempts = safeAttempts + 1;
      if (user.failedLoginAttempts >= 5) {
        const lock = new Date();
        lock.setMinutes(lock.getMinutes() + 15);
        user.lockoutUntil = lock;
      }
      await this.userRepository.save(user);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Single-session: bump tokenVersion to logout other devices/browsers
    const currentVersionLogin = Number((user as any).tokenVersion) || 0;
    (user as any).tokenVersion =
      (currentVersionLogin < 0 || currentVersionLogin > 1000000000
        ? 0
        : currentVersionLogin) + 1;
    await this.userRepository.save(user);

    const tokens = await this.generateTokens(user);

    return {
      user: {
        id: user.id,
        employeeId: (user as any).employeeId ?? null,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isVerified: (user as any).isVerified,
        isBlocked: (user as any).isBlocked,
        emailVerified: (user as any).emailVerified,
        phoneVerified: (user as any).phoneVerified,
        policy: (user as any).policy ?? null,
        createdAt: user.createdAt,
      },
      ...tokens,
    };
  }

  decodeToken(token: string) {
    try {
      return this.jwtService.decode(token);
    } catch {
      return null;
    }
  }

  async refreshToken(userId: string | undefined, dto: RefreshTokenDto) {
    const targetUserId = userId || dto.userId;
    if (!targetUserId) {
      throw new UnauthorizedException('User identifier required for refresh');
    }

    const user = await this.userRepository.findOne({
      where: { id: targetUserId },
    });
    if (!user || !user.refreshTokenHash) {
      throw new UnauthorizedException('Invalid session');
    }

    const isTokenValid = await bcrypt.compare(
      dto.refreshToken,
      user.refreshTokenHash,
    );
    if (!isTokenValid) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.generateTokens(user);
  }

  async logout(userId: string, fcmToken?: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    // Bump version to invalidate all accessTokens immediately (other device kicked)
    const currentVersionLogout = Number((user as any).tokenVersion) || 0;
    (user as any).tokenVersion =
      (currentVersionLogout < 0 || currentVersionLogout > 1000000000
        ? 0
        : currentVersionLogout) + 1;
    user.refreshTokenHash = null;
    user.otpHash = null;
    user.otpExpiresAt = null;
    await this.userRepository.save(user);

    // Deactivate FCM device token so logged out user does not receive push notifications
    if (fcmToken) {
      await this.deviceTokenRepo.update(
        { userId, token: fcmToken },
        { isActive: false },
      );
    } else {
      await this.deviceTokenRepo.update({ userId }, { isActive: false });
    }

    return { loggedOut: true };
  }
}
