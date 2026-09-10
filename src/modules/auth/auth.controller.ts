import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Get,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service.js';
import { LoginUserDto } from './dto/login-user.dto.js';
import { RegisterUserDto } from './dto/register-user.dto.js';
import { RequestOtpDto } from './dto/request-otp.dto.js';
import { VerifyOtpDto } from './dto/verify-otp.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async getMe(@Req() req: any) {
    return req.user;
  }

  @Post('register')
  async register(@Body() dto: RegisterUserDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginUserDto) {
    return this.authService.login(dto);
  }

  /**
   * POST /auth/request-otp — Send an OTP to a phone number.
   * Flutter app sends: { "phone": "9876543210" }
   */
  @Post('request-otp')
  @HttpCode(HttpStatus.OK)
  async requestOtp(@Body() dto: RequestOtpDto) {
    return this.authService.requestOtp(dto);
  }

  /**
   * POST /auth/verify-otp — Verify OTP and return access token + worker profile.
   * Flutter app sends: { "phone": "9876543210", "otp": "123456" }
   */
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  /**
   * POST /auth/reset-password — Reset password using phone + OTP.
   * Flutter app sends: { "phone": "9876543210", "otp": "123456", "newPassword": "..." }
   */
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('users/:userId/refresh')
  @HttpCode(HttpStatus.OK)
  async refreshToken(
    @Param('userId') userId: string,
    @Body() dto: RefreshTokenDto,
  ) {
    return this.authService.refreshToken(userId, dto);
  }
}
