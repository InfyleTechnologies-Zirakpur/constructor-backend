import { PartialType } from '@nestjs/mapped-types';
import { CreateProjectDto } from './create-projects.dto.js';
import { IsEnum, IsOptional } from 'class-validator';

export class UpdateProjectDto extends PartialType(CreateProjectDto) {
  @IsOptional()
  @IsEnum(['draft', 'active', 'completed', 'archived'])
  status?: string;
}
