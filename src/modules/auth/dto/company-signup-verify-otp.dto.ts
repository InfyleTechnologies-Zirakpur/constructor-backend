import { IsEmail, IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class CompanySignupVerifyOtpDto {
  @IsEmail({}, { message: 'Enter a valid email address' })
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/, { message: 'OTP must be a 6-digit code' })
  @Length(6, 6, { message: 'OTP must be a 6-digit code' })
  otp: string;
}
