import { PartialType } from '@nestjs/mapped-types';
import { CreateJobDto } from './create-jobs.dto.js';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateJobDto extends PartialType(CreateJobDto) {
  @IsOptional()
  @IsEnum(['draft', 'published', 'closed'])
  status?: string;
}

export class ModerateJobDto {
  @IsEnum(['published', 'rejected', 'closed'])
  status: string;

  @IsOptional()
  @IsString()
  moderationRemarks?: string;
}
