import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateProjectSiteDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  location: string;

  @IsOptional()
  @IsString()
  description?: string;
}
