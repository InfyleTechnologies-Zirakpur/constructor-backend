import {
  BadRequestException,
  ConflictException,
  Injectable,
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
import type { ResetPasswordDto } from './dto/reset-password.dto.js';
import type { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
  ) {}

  private async generateTokens(user: User) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role as UserRole,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: '15m',
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

  async refresh(_dto: RefreshTokenDto) {
    // In a real app, you'd decode the token or require userId in the DTO to find the user.
    // For simplicity, since refresh token is unique enough, let's find the user by comparing hashes.
    // However, bcrypt.compare is slow to run against ALL users.
    // We should either store the raw refresh token in DB or expect the userId in the refresh request.
    // Since we didn't add userId to RefreshTokenDto, we will just use a generic unauthorized if they don't provide a valid token for the currently authenticated user.
    // Let's modify the flow to require the userId, or we decode a JWT refresh token instead of random bytes.
    throw new BadRequestException(
      'Not fully implemented: Please use JWT for refresh tokens or include userId',
    );
  }

  // Fixing the refresh method properly:
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

  async requestOtp(dto: RequestOtpDto) {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
    });
    if (!user) {
      // Don't leak whether the email exists
      return { message: 'If the email exists, an OTP was sent.' };
    }

    // Generate 6 digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 10);

    // Expires in 10 minutes
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    user.otpHash = otpHash;
    user.otpExpiresAt = expiresAt;
    await this.userRepository.save(user);

    // Simulate sending SMS/Email
    console.log(`[Development Mode] OTP for ${user.email} is: ${otp}`);

    return { message: 'If the email exists, an OTP was sent.' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
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
    // Invalidate sessions
    user.refreshTokenHash = null;

    await this.userRepository.save(user);

    return { message: 'Password has been reset successfully.' };
  }
}
