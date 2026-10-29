import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

/**
 * POST /auth/forgot-password
 * method: "phone" → job seeker (SMS OTP via ApiTxt)
 * method: "email" → company / contractor (email OTP via Unitpost)
 * Site engineers: contractor resets their password — no self-service.
 */
export class ForgotPasswordDto {
  @IsIn(['phone', 'email'])
  method: 'phone' | 'email';

  /** Required when method = "phone" (job seeker) */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  phone?: string;

  /** Required when method = "email" (company / contractor) */
  @IsOptional()
  @IsEmail({}, { message: 'Invalid email address' })
  email?: string;
}
