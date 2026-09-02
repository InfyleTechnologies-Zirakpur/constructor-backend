import { PartialType } from '@nestjs/mapped-types';
import { CreateCompanyDto } from './create-companies.dto.js';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateCompanyDto extends PartialType(CreateCompanyDto) {}

export enum CompanyVerificationStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
}

export class AdminVerifyCompanyDto {
  @IsEnum(CompanyVerificationStatus)
  verificationStatus: CompanyVerificationStatus;

  @IsOptional()
  @IsString()
  verificationRemarks?: string;
}
