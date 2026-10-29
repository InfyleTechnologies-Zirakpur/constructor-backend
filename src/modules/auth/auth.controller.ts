import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Get,
  Param,
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
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { SignupSendOtpDto } from './dto/signup-send-otp.dto.js';
import { SignupVerifyOtpDto } from './dto/signup-verify-otp.dto.js';
import { SetPasswordDto } from './dto/set-password.dto.js';
import { CompanySignupSendOtpDto } from './dto/company-signup-send-otp.dto.js';
import { CompanySignupVerifyOtpDto } from './dto/company-signup-verify-otp.dto.js';
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

  // ════════════════════════════════════════════════════
  //  JOB SEEKER SIGNUP (phone OTP → verify → set password)
  // ════════════════════════════════════════════════════

  /**
   * POST /auth/signup/send-otp
   * Payload: { name, lastName, phone, role: "job_seeker", skill: [...] }
   * Skills required; experience optional (later on profile).
   * Rate limited to 5 requests per minute to prevent SMS flooding.
   */
  @Post('signup/send-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { ttl: 60000, limit: 5 } })
  async signupSendOtp(@Body() dto: SignupSendOtpDto) {
    return this.authService.signupSendOtp(dto);
  }

  /**
   * POST /auth/signup/verify-otp — Verify phone OTP, returns short-lived signupToken.
   */
  @Post('signup/verify-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { ttl: 60000, limit: 10 } })
  async signupVerifyOtp(@Body() dto: SignupVerifyOtpDto) {
    return this.authService.signupVerifyOtp(dto);
  }

  /**
   * POST /auth/signup/set-password
   * Payload: { signupToken, password, confirmPassword } — strong password required.
   * Sets the password and logs the user in (returns tokens + worker profile).
   */
  @Post('signup/set-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { ttl: 60000, limit: 10 } })
  async setPassword(@Body() dto: SetPasswordDto) {
    return this.authService.setPassword(dto);
  }

  /**
   * POST /auth/signup/company/send-otp
   * Payload: { name, email, role: "company" }
   * Sends email OTP for company registration.
   */
  @Post('signup/company/send-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { ttl: 60000, limit: 5 } })
  async companySignupSendOtp(@Body() dto: CompanySignupSendOtpDto) {
    return this.authService.companySignupSendOtp(dto);
  }

  /**
   * POST /auth/signup/company/verify-otp
   * Payload: { email, otp } — returns signupToken + emailVerified: true
   */
  @Post('signup/company/verify-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { ttl: 60000, limit: 10 } })
  async companySignupVerifyOtp(@Body() dto: CompanySignupVerifyOtpDto) {
    return this.authService.companySignupVerifyOtp(dto);
  }

  /**
   * POST /auth/signup/company/set-password
   * Payload: { signupToken, password, confirmPassword }
   * Requires email to be verified. Returns tokens + nextStep: 'company_profile'.
   * Create company profile via POST /companies (auth required).
   */
  @Post('signup/company/set-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { ttl: 60000, limit: 10 } })
  async companySignupSetPassword(@Body() dto: SetPasswordDto) {
    return this.authService.companySignupSetPassword(dto);
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
   * POST /auth/forgot-password — Role-aware OTP for password reset.
   * job_seeker: method "phone" → SMS OTP (ApiTxt)
   * company/contractor: method "email" → email OTP (Unitpost)
   * Site engineers: contractor resets the password — no self-service.
   */
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { ttl: 60000, limit: 5 } })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  /**
   * POST /auth/reset-password — Verify OTP + set new password.
   * job_seeker: { method: "phone", phone, otp, newPassword }
   * company/contractor: { method: "email", email, otp, newPassword }
   */
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { ttl: 60000, limit: 5 } })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  /**
   * POST /auth/refresh — Refresh access token using refresh token.
   * Allows expired JWT in Authorization header or userId in body.
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { ttl: 60000, limit: 10 } })
  async refreshToken(@Req() req: any, @Body() dto: RefreshTokenDto) {
    const authHeader = req.headers['authorization'];
    let userId = req.user?.id || dto.userId;
    if (
      !userId &&
      authHeader &&
      typeof authHeader === 'string' &&
      authHeader.startsWith('Bearer ')
    ) {
      const token = authHeader.substring(7).trim();
      const decoded = this.authService.decodeToken(token);
      if (decoded && (decoded as any).sub) {
        userId = (decoded as any).sub;
      }
    }
    return this.authService.refreshToken(userId, dto);
  }

  /**
   * POST /auth/users/:userId/refresh — Refresh session for a specific user ID.
   */
  @Post('users/:userId/refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ auth: { ttl: 60000, limit: 10 } })
  async refreshUserToken(
    @Param('userId') userId: string,
    @Body() dto: RefreshTokenDto,
  ) {
    return this.authService.refreshToken(userId, dto);
  }

  /**
   * POST /auth/logout — Invalidate current session.
   */
  @Post('logout')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: any, @Body('fcmToken') fcmToken?: string) {
    return this.authService.logout(req.user.id, fcmToken);
  }
}
