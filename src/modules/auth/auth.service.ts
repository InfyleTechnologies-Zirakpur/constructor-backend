import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import type { UserRole } from '../../common/types/role.enum.js';
import { User } from '../users/entities/user.entity.js';
import type { LoginUserDto } from './dto/login-user.dto.js';
import type { RegisterUserDto } from './dto/register-user.dto.js';
import type { RequestOtpDto } from './dto/request-otp.dto.js';
import type { VerifyOtpDto } from './dto/verify-otp.dto.js';
import type { ResetPasswordDto } from './dto/reset-password.dto.js';
import type { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
  ) {}

  private async generateTokens(user: User) {
    const payload = {
      sub: user.id,
      email: user.email,
      phone: user.phone,
      role: user.role as UserRole,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: '7d',
    });
    const refreshToken = randomBytes(40).toString('hex');
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

    user.refreshTokenHash = refreshTokenHash;
    await this.userRepository.save(user);

    return {
      accessToken,
      refreshToken,
    };
  }

  /**
   * Build the "worker" profile object that the Flutter app expects.
   * Shape: { id, name, phone, city, skills, profilePhotoUrl, documents, salaryExpectation }
   */
  private buildWorkerProfile(user: User) {
    return {
      id: user.id,
      name: user.fullName,
      phone: user.phone ?? '',
      city: (user as any).city ?? '',
      skills: (user as any).skills ?? [],
      profilePhotoUrl: user.avatarUrl ?? null,
      documents: (user as any).documents ?? [],
      salaryExpectation: (user as any).salaryExpectation ?? '',
    };
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

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 10);

    // Expires in 10 minutes
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    user.otpHash = otpHash;
    user.otpExpiresAt = expiresAt;
    await this.userRepository.save(user);

    // Log OTP in development (in production, send via SMS)
    this.logger.log(`[DEV MODE] OTP for ${dto.phone}: ${otp}`);

    return {
      otpSent: true,
      message: 'OTP sent successfully',
    };
  }

  /**
   * POST /auth/verify-otp
   * Flutter sends: { "phone": "9876543210", "otp": "123456" }
   * Returns: { accessToken, expiresIn, worker: {...} }
   */
  async verifyOtp(dto: VerifyOtpDto) {
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

    // Clear OTP after successful verification
    user.otpHash = null;
    user.otpExpiresAt = null;
    await this.userRepository.save(user);

    const tokens = await this.generateTokens(user);

    return {
      accessToken: tokens.accessToken,
      expiresIn: 604800, // 7 days in seconds
      worker: this.buildWorkerProfile(user),
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
    const existingUser = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = this.userRepository.create({
      fullName: dto.fullName,
      email: dto.email,
      phone: dto.phone,
      passwordHash,
      role: dto.role,
    });

    const savedUser = await this.userRepository.save(user);
    const tokens = await this.generateTokens(savedUser);

    return {
      user: {
        id: savedUser.id,
        fullName: savedUser.fullName,
        email: savedUser.email,
        phone: savedUser.phone,
        role: savedUser.role,
        createdAt: savedUser.createdAt,
      },
      ...tokens,
    };
  }

  async login(dto: LoginUserDto) {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user);

    return {
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        createdAt: user.createdAt,
      },
      ...tokens,
    };
  }

  async refreshToken(userId: string, dto: RefreshTokenDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
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
}
