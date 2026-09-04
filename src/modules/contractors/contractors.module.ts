import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractorsController } from './contractors.controller.js';
import { ContractorsService } from './contractors.service.js';
import { Contractor } from './entities/contractor.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Contractor])],
  controllers: [ContractorsController],
  providers: [ContractorsService],
  exports: [ContractorsService],
})
export class ContractorsModule {}
