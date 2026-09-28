import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Get,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service.js';
import { LoginUserDto } from './dto/login-user.dto.js';
import { RegisterUserDto } from './dto/register-user.dto.js';
import { RequestOtpDto } from './dto/request-otp.dto.js';
import { VerifyOtpDto } from './dto/verify-otp.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * GET /auth/me — Return the current authenticated user's profile.
   * No sensitive fields — password, OTP hash, etc. are stripped by the JWT strategy.
   */
  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @SkipThrottle()
  async getMe(@Req() req: any) {
    return req.user;
  }

  /**
   * POST /auth/register
   * - Unauthenticated: only 'job_seeker' role is allowed (public self-registration).
   * - Admin-only privileged roles (admin, contractor, site_engineer, company)
   *   must use the Admin Users endpoint (POST /users) instead.
   * Rate limited to 5 requests per minute per IP.
   */
  @Post('register')
  @Throttle({ auth: { ttl: 60000, limit: 5 } })
  async register(@Body() dto: RegisterUserDto) {
    return this.authService.register(dto);
  }

  /**
   * POST /auth/login — Email + password login (Admin / Contractor panel).
   * Strict rate limiting: 10 attempts per minute.
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { ttl: 60000, limit: 10 } })
  async login(@Body() dto: LoginUserDto) {
    return this.authService.login(dto);
  }

  /**
   * POST /auth/request-otp — Send OTP to a phone number.
   * Rate limited to 5 requests per minute to prevent SMS flooding.
   */
  @Post('request-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { ttl: 60000, limit: 5 } })
  async requestOtp(@Body() dto: RequestOtpDto) {
    return this.authService.requestOtp(dto);
  }

  /**
   * POST /auth/verify-otp — Verify OTP and return access token.
   * Rate limited to 10 attempts per minute.
   */
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { ttl: 60000, limit: 10 } })
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  /**
   * POST /auth/reset-password — Reset password using phone + OTP.
   * Rate limited to 5 attempts per minute.
   */
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { ttl: 60000, limit: 5 } })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  /**
   * POST /auth/refresh — Refresh access token using refresh token.
   * Requires a valid (possibly expired) JWT to identify the user — IDOR-safe.
   * The refresh token in the body is validated against the stored hash.
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  @Throttle({ auth: { ttl: 60000, limit: 10 } })
  async refreshToken(@Req() req: any, @Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(req.user.id, dto);
  }

  /**
   * POST /auth/logout — Invalidate current session.
   */
  @Post('logout')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: any) {
    return this.authService.logout(req.user.id);
  }
}
