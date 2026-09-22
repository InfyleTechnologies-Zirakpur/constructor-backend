import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractorsController } from './contractors.controller.js';
import { ContractorsService } from './contractors.service.js';
import { Contractor } from './entities/contractor.entity.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Contractor]), AuthorizationModule],
  controllers: [ContractorsController],
  providers: [ContractorsService],
  exports: [ContractorsService],
})
export class ContractorsModule {}
