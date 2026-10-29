import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class LoginUserDto {
  /** "email" → login with email, "phone" → login with phone */
  @IsIn(['email', 'phone'])
  method: 'email' | 'phone';

  /** Required when method = "email" */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  email?: string;

  /** Required when method = "phone" */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  phone?: string;

  @IsString()
  @MinLength(8)
  password: string;
}
