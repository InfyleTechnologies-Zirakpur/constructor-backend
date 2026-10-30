import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateJobDto {
  @IsNotEmpty()
  @IsString()
  title: string;

  @IsNotEmpty()
  @IsString()
  location: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  compensation?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  workforceRequired?: number;

  @IsOptional()
  @IsString()
  projectType?: string;

  @IsOptional()
  @IsString()
  experienceLevel?: string;

  @IsOptional()
  @IsEnum(['draft', 'published', 'closed'])
  status?: string;

  @IsOptional()
  category?: string;

  @IsOptional()
  salary?: any;

  @IsOptional()
  jobType?: string;

  @IsOptional()
  type?: string;

  @IsOptional()
  experience?: string;

  @IsOptional()
  experienceRequired?: string;
}
