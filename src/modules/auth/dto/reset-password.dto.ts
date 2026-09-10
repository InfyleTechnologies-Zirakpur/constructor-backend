import { IsNotEmpty, IsString, Length, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  @Length(10, 10, { message: 'Phone must be a valid 10-digit number' })
  phone: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'OTP must be exactly 6 digits' })
  otp: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  newPassword: string;
}
