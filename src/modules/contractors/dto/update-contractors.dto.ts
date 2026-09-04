import { PartialType } from '@nestjs/mapped-types';
import { CreateContractorDto } from './create-contractors.dto.js';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateContractorDto extends PartialType(CreateContractorDto) {}

export enum ContractorVerificationStatus {
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
}

export class AdminVerifyContractorDto {
  @IsEnum(ContractorVerificationStatus)
  verificationStatus: ContractorVerificationStatus;

  @IsOptional()
  @IsString()
  verificationRemarks?: string;
}
