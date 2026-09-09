import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Create a material master record (Admin).
 */
export class CreateMaterialDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  unit: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  defaultRate?: number;

  @IsOptional()
  @IsString()
  description?: string;
}

/**
 * Create a material transaction (site-level).
 */
export class CreateMaterialTransactionDto {
  @IsString()
  @IsNotEmpty()
  materialId: string;

  @IsIn(['purchase', 'request', 'issue', 'consumption', 'return'])
  type: string;

  @IsString()
  @IsNotEmpty()
  date: string; // YYYY-MM-DD

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantity: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  rate: number;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsString()
  supplier?: string;

  @IsOptional()
  @IsString()
  referenceNumber?: string;
}
