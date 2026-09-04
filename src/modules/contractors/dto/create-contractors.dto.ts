import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateContractorDto {
  @IsNotEmpty()
  @IsString()
  companyName: string;

  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @IsNotEmpty()
  @IsEmail()
  contactEmail: string;

  @IsNotEmpty()
  @IsString()
  contactPhone: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  documentUrls?: string[];
}
