import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  HttpException,
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
import type { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import type { RefreshTokenDto } from './dto/refresh-token.dto.js';
import type { SignupSendOtpDto } from './dto/signup-send-otp.dto.js';
import type { SignupVerifyOtpDto } from './dto/signup-verify-otp.dto.js';
import type { SetPasswordDto } from './dto/set-password.dto.js';
import type { CompanySignupSendOtpDto } from './dto/company-signup-send-otp.dto.js';
import type { CompanySignupVerifyOtpDto } from './dto/company-signup-verify-otp.dto.js';
import type { UserRole } from '../../common/types/role.enum.js';
import {
  sendOtpSms,
  normalizePhone,
  isValidIndianPhone,
} from '../../common/utils/send-sms.js';
import { sendOtpEmail } from '../../common/utils/send-email.js';
import { randomBytes, randomInt } from 'crypto';

/** JWT purpose claim for the phone-verified → set-password signup window. */
const SIGNUP_TOKEN_PURPOSE = 'job-seeker-signup';

/** JWT purpose claim for the email-verified → set-password company signup. */
const COMPANY_SIGNUP_TOKEN_PURPOSE = 'company-signup';

/**
 * Sentinel passwordHash for pending-signup accounts (password not set yet).
 * Stored instead of NULL so the flow also works on DBs where passwordHash
 * is (incorrectly) NOT NULL. Never matches bcrypt.compare, and every
 * "is a password actually set?" check treats it as absent.
 */
const PENDING_PASSWORD_HASH = '!pending';

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
   * Single source of truth for "has this job seeker finished
   * Create Profile?".
   *
   * Phone-OTP signup (send-otp → verify-otp → set-password) stores
   * name + skills only — the seeker must still fill daily wage
   * (salaryExpectation) and preferred location (city) on the profile
   * screen. Until ALL three exist, isNewUser=true → Create Profile.
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

    const city = ((user as any).city ?? '').toString().trim();
    const skills = (user as any).skills as unknown;
    const salary = ((user as any).salaryExpectation ?? '').toString().trim();
    const hasCity = city !== '' && city.toLowerCase() !== 'null';
    const hasSkills = Array.isArray(skills) && skills.length > 0;
    const hasSalary = salary !== '' && salary.toLowerCase() !== 'null';
    return hasCity && hasSkills && hasSalary;
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

    // NOTE: Firebase Phone Auth (client SDK) is the app's primary path;
    // this endpoint also sends a real SMS via ApiTxt so OTP login /
    // forgot-password work without Firebase.
    const otp = randomInt(100000, 1000000).toString();
    const otpHash = await bcrypt.hash(otp, 10);

    // Expires in 10 minutes
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    user.otpHash = otpHash;
    user.otpExpiresAt = expiresAt;
    await this.userRepository.save(user);

    try {
      await sendOtpSms(dto.phone, otp);
    } catch (e: any) {
      user.otpHash = null;
      user.otpExpiresAt = null;
      await this.userRepository.save(user);
      this.logger.error(`OTP SMS failed for ${dto.phone}: ${e?.message}`);
      // Provider cooldowns (429) pass through with their real message.
      if (e instanceof HttpException) throw e;
      throw new BadGatewayException(
        e?.message || 'Failed to send OTP. Please try again.',
      );
    }

    // Only log OTP in non-production (dry-run / dev testing)
    if (
      process.env.NODE_ENV !== 'production' &&
      process.env.SMS_DRY_RUN === 'true'
    ) {
      this.logger.debug(`[DEV] OTP for ${dto.phone}: ${otp}`);
    }

    return {
      otpSent: true,
      message: 'OTP sent successfully',
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

  // ════════════════════════════════════════════════════
  //  JOB SEEKER SIGNUP (name + phone OTP → verify → set password)
  // ════════════════════════════════════════════════════

  /**
   * POST /auth/signup/send-otp
   * Flutter sends: { name, lastName, phone, role: "job_seeker", skill: [...] }
   * Skills are REQUIRED, experience is optional (collected later on profile).
   * Creates (or refreshes) the pending job-seeker row and texts an OTP via ApiTxt.
   */
  async signupSendOtp(dto: SignupSendOtpDto) {
    const phone = normalizePhone(dto.phone);
    if (!isValidIndianPhone(phone)) {
      throw new BadRequestException('Enter a valid 10-digit mobile number');
    }

    const skills = (dto.skill ?? [])
      .map((s) => String(s).trim())
      .filter(Boolean);
    if (skills.length === 0) {
      throw new BadRequestException('At least one skill is required');
    }

    const existing = await this.userRepository.findOne({ where: { phone } });

    // Fully registered number (real password already set) must use login instead.
    if (
      existing?.passwordHash &&
      existing.passwordHash !== PENDING_PASSWORD_HASH
    ) {
      throw new ConflictException(
        'This mobile number is already registered. Please login.',
      );
    }

    const fullName = `${dto.name.trim()} ${dto.lastName.trim()}`.trim();
    const metadata = {
      ...(((existing as any)?.metadata as Record<string, any>) ?? {}),
      firstName: dto.name.trim(),
      lastName: dto.lastName.trim(),
    };
    const user: User = existing
      ? Object.assign(existing, {
          fullName,
          skills,
          role: dto.role ?? existing.role,
          metadata,
        })
      : (this.userRepository.create({
          fullName,
          email: null,
          phone,
          passwordHash: PENDING_PASSWORD_HASH,
          role: dto.role ?? 'job_seeker',
          skills,
          metadata,
        } as any) as unknown as User);
    await this.userRepository.save(user);

    const otp = randomInt(100000, 1000000).toString();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);
    user.otpHash = otpHash;
    user.otpExpiresAt = expiresAt;
    await this.userRepository.save(user);

    try {
      await sendOtpSms(phone, otp);
    } catch (e: any) {
      user.otpHash = null;
      user.otpExpiresAt = null;
      await this.userRepository.save(user);
      this.logger.error(`Signup OTP SMS failed for ${phone}: ${e?.message}`);
      // Provider cooldowns (429) pass through with their real message.
      if (e instanceof HttpException) throw e;
      throw new BadGatewayException(
        e?.message || 'Failed to send OTP. Please try again.',
      );
    }

    if (
      process.env.NODE_ENV !== 'production' &&
      process.env.SMS_DRY_RUN === 'true'
    ) {
      this.logger.debug(`[DEV] Signup OTP for ${phone}: ${otp}`);
    }

    return {
      otpSent: true,
      message: 'OTP sent successfully',
      phone,
    };
  }

  /**
   * POST /auth/signup/verify-otp
   * Flutter sends: { phone, otp }
   * Verifies the phone only — no login yet. Returns a short-lived
   * signupToken the client must present to POST /auth/signup/set-password.
   */
  async signupVerifyOtp(dto: SignupVerifyOtpDto) {
    const phone = normalizePhone(dto.phone);
    const user = await this.userRepository.findOne({ where: { phone } });

    if (!user || !user.otpHash || !user.otpExpiresAt) {
      throw new BadRequestException('Invalid or expired OTP');
    }
    if ((user as any).isBlocked) {
      throw new UnauthorizedException('Account is blocked');
    }
    if (user.passwordHash && user.passwordHash !== PENDING_PASSWORD_HASH) {
      throw new ConflictException(
        'This mobile number is already registered. Please login.',
      );
    }
    if (new Date() > user.otpExpiresAt) {
      throw new BadRequestException('OTP has expired');
    }

    const isOtpValid = await bcrypt.compare(dto.otp, user.otpHash);
    if (!isOtpValid) {
      throw new BadRequestException('Invalid OTP');
    }

    (user as any).phoneVerified = true;
    user.otpHash = null;
    user.otpExpiresAt = null;
    await this.userRepository.save(user);

    // Short-lived token proving the phone was verified for THIS signup.
    const signupToken = await this.jwtService.signAsync(
      { sub: user.id, phone, purpose: SIGNUP_TOKEN_PURPOSE },
      { expiresIn: '30m' },
    );

    return {
      verified: true,
      message: 'Phone number verified. Please set your password.',
      phone,
      signupToken,
    };
  }

  /**
   * POST /auth/signup/set-password
   * Flutter sends: { signupToken, password, confirmPassword }
   * Sets the strong password on the phone-verified pending account and
   * logs the user in (tokens + worker profile, same shape as verify-otp).
   */
  async setPassword(dto: SetPasswordDto) {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Password and confirm password do not match');
    }

    let decoded: any;
    try {
      decoded = await this.jwtService.verifyAsync(dto.signupToken);
    } catch {
      throw new UnauthorizedException(
        'Phone verification expired. Please verify your number again.',
      );
    }
    if (decoded?.purpose !== SIGNUP_TOKEN_PURPOSE || !decoded?.sub) {
      throw new UnauthorizedException('Invalid signup token');
    }

    const user = await this.userRepository.findOne({
      where: { id: decoded.sub },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if ((user as any).isBlocked) {
      throw new UnauthorizedException('Account is blocked');
    }
    if (user.passwordHash && user.passwordHash !== PENDING_PASSWORD_HASH) {
      throw new ConflictException(
        'Password already set for this account. Please login.',
      );
    }
    if (!(user as any).phoneVerified) {
      throw new UnauthorizedException('Phone number is not verified');
    }

    // Email is NOT collected here — job seekers add it later via PUT /profile.
    user.passwordHash = await bcrypt.hash(dto.password, 10);
    await this.userRepository.save(user);

    const tokens = await this.generateTokens(user);
    // Slim response — Flutter proceeds straight to profile creation
    // (daily wage, preferred location, documents) after password setup.
    return {
      success: true,
      message: 'Success',
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: 604800,
      },
    };
  }

  // ════════════════════════════════════════════════════
  //  COMPANY SIGNUP (name + email OTP → verify → set password)
  //  Then the client creates the company profile via POST /companies.
  // ════════════════════════════════════════════════════

  /**
   * POST /auth/signup/company/send-otp
   * Payload: { name, email, role: "company" }
   * Creates/refreshes a pending company account and emails a 6-digit OTP.
   */
  async companySignupSendOtp(dto: CompanySignupSendOtpDto) {
    const email = String(dto.email ?? '').trim().toLowerCase();
    if (!email) {
      throw new BadRequestException('Email is required');
    }

    const existing = await this.userRepository.findOne({ where: { email } });

    if (existing) {
      if (existing.role !== 'company') {
        throw new ConflictException(
          'This email is already registered with a different account type.',
        );
      }
      if (
        existing.passwordHash &&
        existing.passwordHash !== PENDING_PASSWORD_HASH
      ) {
        throw new ConflictException(
          'This email is already registered. Please login.',
        );
      }
    }

    const user: User = existing
      ? Object.assign(existing, {
          fullName: dto.name?.trim() ? dto.name.trim() : existing.fullName,
          role: 'company',
        })
      : (this.userRepository.create({
          fullName: dto.name?.trim() || 'Company',
          email,
          phone: null,
          passwordHash: PENDING_PASSWORD_HASH,
          role: 'company',
        } as any) as unknown as User);
    await this.userRepository.save(user);

    const otp = randomInt(100000, 1000000).toString();
    user.otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);
    user.otpExpiresAt = expiresAt;
    await this.userRepository.save(user);

    try {
      await sendOtpEmail(email, otp, {
        name: user.fullName,
        expiryMinutes: 10,
      });
    } catch (e: any) {
      user.otpHash = null;
      user.otpExpiresAt = null;
      await this.userRepository.save(user);
      this.logger.error(`Company signup OTP email failed for ${email}: ${e?.message}`);
      if (e instanceof HttpException) throw e;
      throw new BadGatewayException(
        e?.message || 'Failed to send OTP. Please try again.',
      );
    }

    if (
      process.env.NODE_ENV !== 'production' &&
      process.env.EMAIL_DRY_RUN === 'true'
    ) {
      this.logger.debug(`[DEV] Company signup OTP for ${email}: ${otp}`);
    }

    return {
      otpSent: true,
      message: 'OTP sent to your email',
      email,
    };
  }

  /**
   * POST /auth/signup/company/verify-otp
   * Payload: { email, otp }
   * Verifies the email only. Returns emailVerified + a short-lived
   * signupToken required by /auth/signup/company/set-password.
   */
  async companySignupVerifyOtp(dto: CompanySignupVerifyOtpDto) {
    const email = String(dto.email ?? '').trim().toLowerCase();
    const user = await this.userRepository.findOne({ where: { email } });

    if (
      !user ||
      user.role !== 'company' ||
      !user.otpHash ||
      !user.otpExpiresAt
    ) {
      throw new BadRequestException('Invalid or expired OTP');
    }
    if ((user as any).isBlocked) {
      throw new UnauthorizedException('Account is blocked');
    }
    if (user.passwordHash && user.passwordHash !== PENDING_PASSWORD_HASH) {
      throw new ConflictException(
        'This email is already registered. Please login.',
      );
    }
    if (new Date() > user.otpExpiresAt) {
      throw new BadRequestException('OTP has expired');
    }

    const isOtpValid = await bcrypt.compare(dto.otp, user.otpHash);
    if (!isOtpValid) {
      throw new BadRequestException('Invalid OTP');
    }

    user.emailVerified = true;
    user.otpHash = null;
    user.otpExpiresAt = null;
    await this.userRepository.save(user);

    const signupToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        email,
        purpose: COMPANY_SIGNUP_TOKEN_PURPOSE,
      },
      { expiresIn: '30m' },
    );

    return {
      verified: true,
      emailVerified: true,
      message: 'Email verified. Please set your password.',
      email,
      signupToken,
    };
  }

  /**
   * POST /auth/signup/company/set-password
   * Payload: { signupToken, password, confirmPassword }
   * Sets the strong password on the email-verified pending account, logs
   * the user in, and tells the client to continue with the company
   * profile form (POST /companies with the returned accessToken).
   */
  async companySignupSetPassword(dto: SetPasswordDto) {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException(
        'Password and confirm password do not match',
      );
    }

    let decoded: any;
    try {
      decoded = await this.jwtService.verifyAsync(dto.signupToken);
    } catch {
      throw new UnauthorizedException(
        'Email verification expired. Please verify your email again.',
      );
    }
    if (decoded?.purpose !== COMPANY_SIGNUP_TOKEN_PURPOSE || !decoded?.sub) {
      throw new UnauthorizedException('Invalid signup token');
    }

    const user = await this.userRepository.findOne({
      where: { id: decoded.sub },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if ((user as any).isBlocked) {
      throw new UnauthorizedException('Account is blocked');
    }
    if (user.passwordHash && user.passwordHash !== PENDING_PASSWORD_HASH) {
      throw new ConflictException(
        'Password already set for this account. Please login.',
      );
    }
    if (!user.emailVerified) {
      throw new UnauthorizedException('Email is not verified');
    }

    user.passwordHash = await bcrypt.hash(dto.password, 10);
    await this.userRepository.save(user);

    const tokens = await this.generateTokens(user);

    return {
      success: true,
      message: 'Password set successfully',
      data: {
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          phone: user.phone ?? null,
          role: user.role,
          emailVerified: user.emailVerified,
          phoneVerified: user.phoneVerified,
        },
        emailVerified: true,
        nextStep: 'company_profile',
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: 604800,
      },
    };
  }

  // ════════════════════════════════════════════════════
  //  FORGOT / RESET PASSWORD (role-aware)
  //  job_seeker          → phone + SMS OTP (ApiTxt)
  //  company / contractor → email + OTP (Unitpost)
  //  site_engineer       → contractor sets the password (no self-service)
  // ════════════════════════════════════════════════════

  /**
   * POST /auth/forgot-password
   * method: "phone" → job seeker, SMS OTP
   * method: "email" → company / contractor, email OTP via Unitpost
   */
  async forgotPassword(dto: ForgotPasswordDto) {
    if (dto.method === 'phone') {
      const phone = normalizePhone(dto.phone);
      if (!isValidIndianPhone(phone)) {
        throw new BadRequestException('Enter a valid 10-digit mobile number');
      }
      const user = await this.userRepository.findOne({ where: { phone } });
      // Generic message — no account enumeration.
      if (!user || user.role !== 'job_seeker') {
        return this.forgotPasswordGenericResponse('phone', phone);
      }
      if ((user as any).isBlocked) {
        throw new UnauthorizedException('Account is blocked');
      }

      await this.issueResetOtp(user);
      try {
        await sendOtpSms(phone, (user as any).__otpPlain);
      } catch (e: any) {
        await this.clearResetOtp(user);
        this.logger.error(`Forgot-password SMS failed for ${phone}: ${e?.message}`);
        if (e instanceof HttpException) throw e;
        throw new BadGatewayException(
          e?.message || 'Failed to send OTP. Please try again.',
        );
      }
      if (
        process.env.NODE_ENV !== 'production' &&
        process.env.SMS_DRY_RUN === 'true'
      ) {
        this.logger.debug(`[DEV] Reset OTP for ${phone}: ${(user as any).__otpPlain}`);
      }
      return this.forgotPasswordGenericResponse('phone', phone);
    }

    // method === 'email' — company / contractor
    const email = dto.email?.trim().toLowerCase();
    if (!email) {
      throw new BadRequestException('Email is required for email login');
    }
    const user = await this.userRepository.findOne({ where: { email } });
    if (
      !user ||
      (user.role !== 'company' && user.role !== 'contractor')
    ) {
      return this.forgotPasswordGenericResponse('email', email);
    }
    if ((user as any).isBlocked) {
      throw new UnauthorizedException('Account is blocked');
    }

    await this.issueResetOtp(user);
    try {
      await sendOtpEmail(email, (user as any).__otpPlain, {
        name: user.fullName,
        expiryMinutes: 10,
      });
    } catch (e: any) {
      await this.clearResetOtp(user);
      this.logger.error(`Forgot-password email failed for ${email}: ${e?.message}`);
      if (e instanceof HttpException) throw e;
      throw new BadGatewayException(
        e?.message || 'Failed to send OTP. Please try again.',
      );
    }
    if (
      process.env.NODE_ENV !== 'production' &&
      process.env.EMAIL_DRY_RUN === 'true'
    ) {
      this.logger.debug(`[DEV] Reset OTP for ${email}: ${(user as any).__otpPlain}`);
    }
    return this.forgotPasswordGenericResponse('email', email);
  }

  /** Same shape regardless of whether the account exists (no enumeration). */
  private forgotPasswordGenericResponse(
    method: 'phone' | 'email',
    identifier: string,
  ) {
    return {
      otpSent: true,
      message: 'If an account exists, an OTP has been sent',
      method,
      ...(method === 'phone' ? { phone: identifier } : { email: identifier }),
    };
  }

  /** Generates a 6-digit OTP, stores its hash + 10-min expiry, keeps plain on a transient field. */
  private async issueResetOtp(user: User) {
    const otp = randomInt(100000, 1000000).toString();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);
    user.otpHash = otpHash;
    user.otpExpiresAt = expiresAt;
    await this.userRepository.save(user);
    (user as any).__otpPlain = otp; // transient — never saved
  }

  private async clearResetOtp(user: User) {
    user.otpHash = null;
    user.otpExpiresAt = null;
    await this.userRepository.save(user);
  }

  /**
   * POST /auth/reset-password
   * job_seeker:          { method: "phone", phone, otp, newPassword }
   * company / contractor: { method: "email", email, otp, newPassword }
   */
  async resetPassword(dto: ResetPasswordDto) {
    const user =
      dto.method === 'phone'
        ? await this.userRepository.findOne({
            where: { phone: normalizePhone(dto.phone) },
          })
        : await this.userRepository.findOne({
            where: { email: dto.email?.trim().toLowerCase() },
          });

    if (!user || !user.otpHash || !user.otpExpiresAt) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    // Role guards per method — a company cannot reset via phone, etc.
    if (dto.method === 'phone' && user.role !== 'job_seeker') {
      throw new BadRequestException(
        'Use the email method to reset the password for this account',
      );
    }
    if (
      dto.method === 'email' &&
      user.role !== 'company' &&
      user.role !== 'contractor'
    ) {
      throw new BadRequestException(
        'Use the phone method to reset the password for this account',
      );
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

    user.passwordHash = await bcrypt.hash(dto.newPassword, 10);
    user.otpHash = null;
    user.otpExpiresAt = null;
    user.refreshTokenHash = null;
    // Reset also bumps tokenVersion so all existing sessions die.
    const currentVersionReset = Number((user as any).tokenVersion) || 0;
    (user as any).tokenVersion =
      (currentVersionReset < 0 || currentVersionReset > 1000000000
        ? 0
        : currentVersionReset) + 1;

    await this.userRepository.save(user);

    return { changed: true, message: 'Password reset successfully' };
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
    // method: "email" → email + password, "phone" → phone + password
    const identifier =
      dto.method === 'email'
        ? dto.email?.trim().toLowerCase()
        : dto.phone?.trim();
    if (!identifier) {
      throw new BadRequestException(
        dto.method === 'email'
          ? 'Email is required for email login'
          : 'Phone is required for phone login',
      );
    }

    const user = await this.userRepository.findOne({
      where: dto.method === 'email' ? { email: identifier } : { phone: identifier },
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

    if (!user.passwordHash || user.passwordHash === PENDING_PASSWORD_HASH) {
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

    // Authoritative profile-completeness so the app routes straight to
    // Home for finished profiles instead of re-showing Create Profile.
    const isProfileComplete = this.isWorkerProfileComplete(user);

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
        profileCompleted: isProfileComplete,
        createdAt: user.createdAt,
      },
      isProfileComplete,
      isNewUser: !isProfileComplete,
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
