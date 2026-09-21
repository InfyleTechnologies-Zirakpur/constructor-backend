import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import type { UserRole } from '../../../common/types/role.enum.js';

export class RegisterUserDto {
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  policy?: Record<string, any>;

  @IsEnum([
    'admin',
    'job_seeker',
    'company',
    'contractor',
    'site_engineer',
  ] as const)
  role: UserRole = 'job_seeker';
}
