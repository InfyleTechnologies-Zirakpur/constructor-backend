import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CalculatorsService } from './calculators.service.js';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';

@Controller('calculators')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class CalculatorsController {
  constructor(private readonly calculatorsService: CalculatorsService) {}

  /**
   * GET /calculators/concrete — Concrete quantity estimation
   */
  @Get('concrete')
  @Roles('admin', 'contractor', 'site_engineer', 'company', 'job_seeker')
  getConcreteEstimate(
    @Query('length') length: string,
    @Query('breadth') breadth: string,
    @Query('height') height: string,
    @Query('mixRatio') mixRatio = '1:2:4',
  ) {
    return {
      success: true,
      data: this.calculatorsService.calculateConcrete(
        Number(length),
        Number(breadth),
        Number(height),
        mixRatio,
      ),
    };
  }

  /**
   * GET /calculators/cement — Cement quantity estimation
   */
  @Get('cement')
  @Roles('admin', 'contractor', 'site_engineer', 'company', 'job_seeker')
  getCementEstimate(
    @Query('area') area: string,
    @Query('thickness') thickness: string,
    @Query('mixRatio') mixRatio = '1:4',
  ) {
    return {
      success: true,
      data: this.calculatorsService.calculateCement(
        Number(area),
        Number(thickness),
        mixRatio,
      ),
    };
  }

  /**
   * GET /calculators/sand — Sand quantity estimation
   */
  @Get('sand')
  @Roles('admin', 'contractor', 'site_engineer', 'company', 'job_seeker')
  getSandEstimate(
    @Query('area') area: string,
    @Query('thickness') thickness: string,
    @Query('mixRatio') mixRatio = '1:4',
  ) {
    return {
      success: true,
      data: this.calculatorsService.calculateSand(
        Number(area),
        Number(thickness),
        mixRatio,
      ),
    };
  }

  /**
   * GET /calculators/aggregate — Aggregate quantity estimation
   */
  @Get('aggregate')
  @Roles('admin', 'contractor', 'site_engineer', 'company', 'job_seeker')
  getAggregateEstimate(
    @Query('length') length: string,
    @Query('breadth') breadth: string,
    @Query('height') height: string,
    @Query('mixRatio') mixRatio = '1:2:4',
  ) {
    return {
      success: true,
      data: this.calculatorsService.calculateAggregate(
        Number(length),
        Number(breadth),
        Number(height),
        mixRatio,
      ),
    };
  }

  /**
   * GET /calculators/brick — Brick quantity estimation
   */
  @Get('brick')
  @Roles('admin', 'contractor', 'site_engineer', 'company', 'job_seeker')
  getBrickEstimate(
    @Query('wallLength') wallLength: string,
    @Query('wallHeight') wallHeight: string,
    @Query('wallThickness') wallThickness: string,
    @Query('mortarThickness') mortarThickness = '0.01',
  ) {
    return {
      success: true,
      data: this.calculatorsService.calculateBrick(
        Number(wallLength),
        Number(wallHeight),
        Number(wallThickness),
        Number(mortarThickness),
      ),
    };
  }

  /**
   * GET /calculators/steel — Steel reinforcement estimation
   */
  @Get('steel')
  @Roles('admin', 'contractor', 'site_engineer', 'company', 'job_seeker')
  getSteelEstimate(
    @Query('length') length: string,
    @Query('breadth') breadth: string,
    @Query('depth') depth: string,
    @Query('steelPercentage') steelPercentage = '1',
  ) {
    return {
      success: true,
      data: this.calculatorsService.calculateSteel(
        Number(length),
        Number(breadth),
        Number(depth),
        Number(steelPercentage),
      ),
    };
  }

  /**
   * GET /calculators/flooring — Tile/flooring quantity estimation
   */
  @Get('flooring')
  @Roles('admin', 'contractor', 'site_engineer', 'company', 'job_seeker')
  getFlooringEstimate(
    @Query('roomLength') roomLength: string,
    @Query('roomBreadth') roomBreadth: string,
    @Query('tileLength') tileLength: string,
    @Query('tileBreadth') tileBreadth: string,
    @Query('wastagePercent') wastagePercent = '5',
  ) {
    return {
      success: true,
      data: this.calculatorsService.calculateFlooring(
        Number(roomLength),
        Number(roomBreadth),
        Number(tileLength),
        Number(tileBreadth),
        Number(wastagePercent),
      ),
    };
  }

  /**
   * GET /calculators/paint — Paint quantity estimation
   */
  @Get('paint')
  @Roles('admin', 'contractor', 'site_engineer', 'company', 'job_seeker')
  getPaintEstimate(
    @Query('wallArea') wallArea: string,
    @Query('coats') coats = '2',
    @Query('coveragePerLitre') coveragePerLitre = '12',
  ) {
    return {
      success: true,
      data: this.calculatorsService.calculatePaint(
        Number(wallArea),
        Number(coats),
        Number(coveragePerLitre),
      ),
    };
  }

  /**
   * GET /calculators/plaster — Plaster quantity estimation
   */
  @Get('plaster')
  @Roles('admin', 'contractor', 'site_engineer', 'company', 'job_seeker')
  getPlasterEstimate(
    @Query('area') area: string,
    @Query('thickness') thickness: string,
    @Query('mixRatio') mixRatio = '1:4',
  ) {
    return {
      success: true,
      data: this.calculatorsService.calculatePlaster(
        Number(area),
        Number(thickness),
        mixRatio,
      ),
    };
  }

  /**
   * GET /calculators/material-estimation — General material estimation
   */
  @Get('material-estimation')
  @Roles('admin', 'contractor', 'site_engineer', 'company', 'job_seeker')
  getMaterialEstimation(
    @Query('area') area: string,
    @Query('thickness') thickness = '0.15',
    @Query('materialType') materialType = 'concrete',
  ) {
    return {
      success: true,
      data: this.calculatorsService.calculateMaterialEstimation(
        Number(area),
        Number(thickness),
        materialType,
      ),
    };
  }
}
