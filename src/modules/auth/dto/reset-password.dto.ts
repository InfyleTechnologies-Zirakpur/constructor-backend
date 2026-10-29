import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MinLength,
} from 'class-validator';

export const STRONG_PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).{8,}$/;

/**
 * POST /auth/reset-password
 * Job seeker: { method: "phone", phone, otp, newPassword }
 * Company / contractor: { method: "email", email, otp, newPassword }
 */
export class ResetPasswordDto {
  @IsIn(['phone', 'email'])
  method: 'phone' | 'email';

  /** Required when method = "phone" */
  @IsOptional()
  @IsString()
  @Length(10, 10, { message: 'Phone must be a valid 10-digit number' })
  phone?: string;

  /** Required when method = "email" */
  @IsOptional()
  @IsEmail({}, { message: 'Invalid email address' })
  email?: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'OTP must be exactly 6 digits' })
  otp: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Matches(STRONG_PASSWORD_REGEX, {
    message:
      'Password must include uppercase, lowercase, number and special character',
  })
  newPassword: string;
}
