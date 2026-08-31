import { Controller, Get, Query } from '@nestjs/common';
import { CalculatorsService } from './calculators.service.js';

@Controller('calculators')
export class CalculatorsController {
  constructor(private readonly calculatorsService: CalculatorsService) {}

  @Get('concrete')
  getConcreteEstimate(
    @Query('length') length: string,
    @Query('breadth') breadth: string,
    @Query('height') height: string,
    @Query('mixRatio') mixRatio = '1:2:4',
  ) {
    const data = this.calculatorsService.calculateConcrete(
      Number(length),
      Number(breadth),
      Number(height),
      mixRatio,
    );

    return {
      success: true,
      data,
    };
  }
}
