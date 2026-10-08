import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Concrete calculator — volume-based with mix ratio, grade, quantity, wastage, trucks, and steel.
 */
export class ConcreteCalculatorDto {
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  length: number;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  breadth: number;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  height: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsString()
  @IsIn(['M5', 'M7.5', 'M10', 'M15', 'M20', 'M25'])
  grade?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d+)?:\d+(\.\d+)?:\d+(\.\d+)?$/)
  mixRatio?: string; // e.g. "1:2:4", "1:1.5:3"

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(20)
  wastagePercent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  truckCapacityM3?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  steelKgPerM3?: number;
}

/**
 * Cement calculator — area-based with thickness, mixRatio, and wastage.
 */
export class CementCalculatorDto {
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  area: number; // in sq. meters

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  thickness: number; // in meters

  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d+)?:\d+(\.\d+)?$/)
  mixRatio?: string; // e.g. "1:4", "1:6"

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(20)
  wastagePercent?: number;
}

/**
 * Sand calculator — area-based with thickness, mixRatio, and wastage.
 */
export class SandCalculatorDto {
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  area: number;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  thickness: number;

  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d+)?:\d+(\.\d+)?$/)
  mixRatio?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(20)
  wastagePercent?: number;
}

/**
 * Aggregate calculator — volume-based with mix ratio, grade, and wastage.
 */
export class AggregateCalculatorDto {
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  length: number;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  breadth: number;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  height: number;

  @IsOptional()
  @IsString()
  @IsIn(['M5', 'M7.5', 'M10', 'M15', 'M20', 'M25'])
  grade?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d+)?:\d+(\.\d+)?:\d+(\.\d+)?$/)
  mixRatio?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(20)
  wastagePercent?: number;
}

/**
 * Brick calculator — wall dimensions with mortarRatio and wastage.
 */
export class BrickCalculatorDto {
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  wallLength: number; // meters

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  wallHeight: number; // meters

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  wallThickness: number; // meters (0.115 for half-brick, 0.23 for full)

  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d+)?:\d+(\.\d+)?$/)
  mortarRatio?: string; // e.g. "1:6"

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(20)
  wastagePercent?: number;
}

/**
 * Steel calculator — slab/beam reinforcement estimation.
 */
export class SteelCalculatorDto {
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  length: number;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  breadth: number;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
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
  @IsPositive()
  roomLength: number; // meters

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  roomBreadth: number; // meters

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  tileLength: number; // meters (e.g. 0.6 for 60cm tile)

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  tileBreadth: number; // meters

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(20)
  wastagePercent?: number; // default 5%
}

/**
 * Paint calculator — area-based.
 */
export class PaintCalculatorDto {
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  wallArea: number; // sq. meters

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  coats?: number; // default 2

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  coveragePerLitre?: number; // sq. m per litre, default 12
}

/**
 * Plaster calculator — area-based with thickness, mixRatio, and wastage.
 */
export class PlasterCalculatorDto {
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  area: number; // sq. meters

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  thickness: number; // meters (e.g. 0.012 for 12mm, 0.02 for 20mm)

  @IsOptional()
  @IsString()
  @Matches(/^\d+(\.\d+)?:\d+(\.\d+)?$/)
  mixRatio?: string; // e.g. "1:4", "1:6"

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(20)
  wastagePercent?: number;
}

/**
 * General material estimation — multi-purpose.
 */
export class MaterialEstimationDto {
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  area: number; // sq. meters

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  thickness?: number; // meters

  @IsOptional()
  @IsString()
  @IsIn(['concrete', 'plaster', 'mortar'])
  materialType?: string; // "concrete", "plaster", "mortar"
}
