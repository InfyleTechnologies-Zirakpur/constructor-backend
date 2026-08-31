import { Module } from '@nestjs/common';
import { CalculatorsController } from './calculators.controller.js';
import { CalculatorsService } from './calculators.service.js';

@Module({
  controllers: [CalculatorsController],
  providers: [CalculatorsService],
})
export class CalculatorsModule {}
