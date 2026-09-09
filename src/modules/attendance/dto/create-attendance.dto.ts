import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Check-in DTO — matches the Flutter app contract.
 */
export class CheckInDto {
  @Type(() => Number)
  @IsNumber()
  latitude: number;

  @Type(() => Number)
  @IsNumber()
  longitude: number;

  @IsOptional()
  @IsString()
  siteId?: string;
}

/**
 * Check-out DTO.
 */
export class CheckOutDto {
  @Type(() => Number)
  @IsNumber()
  latitude: number;

  @Type(() => Number)
  @IsNumber()
  longitude: number;
}

/**
 * Create Labour Record DTO.
 */
export class CreateLabourRecordDto {
  @IsString()
  siteId: string;

  @IsString()
  date: string; // YYYY-MM-DD

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  headcount: number;

  @IsOptional()
  @IsString()
  category?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  dailyWage: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  overtimeHours?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  overtimeRate?: number;

  @IsOptional()
  @IsString()
  remarks?: string;
}
