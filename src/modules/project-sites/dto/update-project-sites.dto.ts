import { PartialType } from '@nestjs/mapped-types';
import { CreateProjectSiteDto } from './create-project-sites.dto.js';
import { IsEnum, IsOptional } from 'class-validator';

export class UpdateProjectSiteDto extends PartialType(CreateProjectSiteDto) {
  @IsOptional()
  @IsEnum(['active', 'inactive', 'completed'])
  status?: string;
}
