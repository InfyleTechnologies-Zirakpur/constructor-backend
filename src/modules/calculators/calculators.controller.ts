import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CalculatorsService } from './calculators.service.js';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import {
  AggregateCalculatorDto,
  BrickCalculatorDto,
  CementCalculatorDto,
  ConcreteCalculatorDto,
  FlooringCalculatorDto,
  MaterialEstimationDto,
  PaintCalculatorDto,
  PlasterCalculatorDto,
  SandCalculatorDto,
  SteelCalculatorDto,
} from './dto/create-calculators.dto.js';

@Controller('calculators')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class CalculatorsController {
  constructor(private readonly calculatorsService: CalculatorsService) {}

  /**
   * GET /calculators/concrete — Concrete quantity estimation
   */
  @Get('concrete')
  @Roles('admin', 'contractor', 'site_engineer', 'company', 'job_seeker')
  getConcreteEstimate(@Query() dto: ConcreteCalculatorDto) {
    return this.calculatorsService.calculateConcrete(
      dto.length,
      dto.breadth,
      dto.height,
      {
        quantity: dto.quantity,
        grade: dto.grade,
        mixRatio: dto.mixRatio,
        wastagePercent: dto.wastagePercent,
        truckCapacityM3: dto.truckCapacityM3,
        steelKgPerM3: dto.steelKgPerM3,
      },
    );
  }

  /**
   * GET /calculators/cement — Cement quantity estimation
   */
  @Get('cement')
  @Roles('admin', 'contractor', 'site_engineer', 'company', 'job_seeker')
  getCementEstimate(@Query() dto: CementCalculatorDto) {
    return this.calculatorsService.calculateCement(dto.area, dto.thickness, {
      mixRatio: dto.mixRatio,
      wastagePercent: dto.wastagePercent,
    });
  }

  /**
   * GET /calculators/sand — Sand quantity estimation
   */
  @Get('sand')
  @Roles('admin', 'contractor', 'site_engineer', 'company', 'job_seeker')
  getSandEstimate(@Query() dto: SandCalculatorDto) {
    return this.calculatorsService.calculateSand(dto.area, dto.thickness, {
      mixRatio: dto.mixRatio,
      wastagePercent: dto.wastagePercent,
    });
  }

  /**
   * GET /calculators/aggregate — Aggregate quantity estimation
   */
  @Get('aggregate')
  @Roles('admin', 'contractor', 'site_engineer', 'company', 'job_seeker')
  getAggregateEstimate(@Query() dto: AggregateCalculatorDto) {
    return this.calculatorsService.calculateAggregate(
      dto.length,
      dto.breadth,
      dto.height,
      {
        grade: dto.grade,
        mixRatio: dto.mixRatio,
        wastagePercent: dto.wastagePercent,
      },
    );
  }

  /**
   * GET /calculators/brick — Brick quantity estimation
   */
  @Get('brick')
  @Roles('admin', 'contractor', 'site_engineer', 'company', 'job_seeker')
  getBrickEstimate(@Query() dto: BrickCalculatorDto) {
    return this.calculatorsService.calculateBrick(
      dto.wallLength,
      dto.wallHeight,
      dto.wallThickness,
      {
        mortarRatio: dto.mortarRatio,
        wastagePercent: dto.wastagePercent,
      },
    );
  }

  /**
   * GET /calculators/steel — Steel reinforcement estimation
   */
  @Get('steel')
  @Roles('admin', 'contractor', 'site_engineer', 'company', 'job_seeker')
  getSteelEstimate(@Query() dto: SteelCalculatorDto) {
    return this.calculatorsService.calculateSteel(
      dto.length,
      dto.breadth,
      dto.depth,
      dto.steelPercentage,
    );
  }

  /**
   * GET /calculators/flooring — Tile/flooring quantity estimation
   */
  @Get('flooring')
  @Roles('admin', 'contractor', 'site_engineer', 'company', 'job_seeker')
  getFlooringEstimate(@Query() dto: FlooringCalculatorDto) {
    return this.calculatorsService.calculateFlooring(
      dto.roomLength,
      dto.roomBreadth,
      dto.tileLength,
      dto.tileBreadth,
      dto.wastagePercent,
    );
  }

  /**
   * GET /calculators/paint — Paint quantity estimation
   */
  @Get('paint')
  @Roles('admin', 'contractor', 'site_engineer', 'company', 'job_seeker')
  getPaintEstimate(@Query() dto: PaintCalculatorDto) {
    return this.calculatorsService.calculatePaint(
      dto.wallArea,
      dto.coats,
      dto.coveragePerLitre,
    );
  }

  /**
   * GET /calculators/plaster — Plaster quantity estimation
   */
  @Get('plaster')
  @Roles('admin', 'contractor', 'site_engineer', 'company', 'job_seeker')
  getPlasterEstimate(@Query() dto: PlasterCalculatorDto) {
    return this.calculatorsService.calculatePlaster(dto.area, dto.thickness, {
      mixRatio: dto.mixRatio,
      wastagePercent: dto.wastagePercent,
    });
  }

  /**
   * GET /calculators/material-estimation — General material estimation
   */
  @Get('material-estimation')
  @Roles('admin', 'contractor', 'site_engineer', 'company', 'job_seeker')
  getMaterialEstimation(@Query() dto: MaterialEstimationDto) {
    return this.calculatorsService.calculateMaterialEstimation(
      dto.area,
      dto.thickness,
      dto.materialType,
    );
  }
}
