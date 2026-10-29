import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class SignupVerifyOtpDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[6-9]\d{9}$/, {
    message: 'Phone must be a valid 10-digit Indian mobile number',
  })
  phone: string;

  @IsString()
  @IsNotEmpty()
  @Length(4, 8, { message: 'OTP must be 4-8 digits' })
  otp: string;
}
