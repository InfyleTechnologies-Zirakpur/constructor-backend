import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Concrete calculator — volume-based with mix ratio.
 */
export class ConcreteCalculatorDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  length: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  breadth: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  height: number;

  @IsOptional()
  @IsString()
  mixRatio?: string; // e.g. "1:2:4", "1:1.5:3"
}

/**
 * Cement calculator — area-based with thickness.
 */
export class CementCalculatorDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  area: number; // in sq. meters

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  thickness: number; // in meters

  @IsOptional()
  @IsString()
  mixRatio?: string; // e.g. "1:4", "1:6"
}

/**
 * Sand calculator — area-based with thickness.
 */
export class SandCalculatorDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  area: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  thickness: number;

  @IsOptional()
  @IsString()
  mixRatio?: string;
}

/**
 * Aggregate calculator — volume-based.
 */
export class AggregateCalculatorDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  length: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  breadth: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  height: number;

  @IsOptional()
  @IsString()
  mixRatio?: string;
}

/**
 * Brick calculator — wall dimensions.
 */
export class BrickCalculatorDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  wallLength: number; // meters

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  wallHeight: number; // meters

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  wallThickness: number; // meters (0.115 for half-brick, 0.23 for full)

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  mortarThickness?: number; // meters, default 0.01 (10mm)
}

/**
 * Steel calculator — slab/beam reinforcement estimation.
 */
export class SteelCalculatorDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  length: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  breadth: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  depth: number; // slab/beam depth in meters

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  steelPercentage?: number; // default 1% of concrete volume
}

/**
 * Flooring calculator — area-based with tile dimensions.
 */
export class FlooringCalculatorDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  roomLength: number; // meters

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  roomBreadth: number; // meters

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  tileLength: number; // meters (e.g. 0.6 for 60cm tile)

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  tileBreadth: number; // meters

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  wastagePercent?: number; // default 5%
}

/**
 * Paint calculator — area-based.
 */
export class PaintCalculatorDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  wallArea: number; // sq. meters

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  coats?: number; // default 2

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  coveragePerLitre?: number; // sq. m per litre, default 12
}

/**
 * Plaster calculator — area-based with thickness.
 */
export class PlasterCalculatorDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  area: number; // sq. meters

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  thickness: number; // meters (e.g. 0.012 for 12mm, 0.02 for 20mm)

  @IsOptional()
  @IsString()
  mixRatio?: string; // e.g. "1:4", "1:6"
}

/**
 * General material estimation — multi-purpose.
 */
export class MaterialEstimationDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  area: number; // sq. meters

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  thickness?: number; // meters

  @IsOptional()
  @IsString()
  materialType?: string; // "concrete", "plaster", "mortar", etc.
}
