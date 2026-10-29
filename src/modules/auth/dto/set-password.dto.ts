import {
  IsNotEmpty,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

// Strong password: 8+ chars with uppercase, lowercase, digit and special char
export const STRONG_PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\da-zA-Z]).{8,}$/;

export class SetPasswordDto {
  @IsString()
  @IsNotEmpty()
  signupToken: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @Matches(STRONG_PASSWORD_REGEX, {
    message:
      'Password must include uppercase, lowercase, number and special character',
  })
  password: string;

  @IsString()
  @IsNotEmpty()
  confirmPassword: string;
}
