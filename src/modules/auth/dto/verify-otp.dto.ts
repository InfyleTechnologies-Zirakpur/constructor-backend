import { IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  @IsNotEmpty()
  @Length(10, 15, { message: 'Phone must be a valid number' })
  phone: string;

  // 6-digit custom OTP OR Firebase ID token (JWT ~ 500+ chars) — keep same endpoint, use Firebase
  @IsString()
  @IsNotEmpty()
  @Length(6, 2000, { message: 'OTP / Firebase ID token required' })
  otp: string;

  @IsOptional()
  @IsString()
  idToken?: string; // alternative: pass Firebase idToken directly
}
