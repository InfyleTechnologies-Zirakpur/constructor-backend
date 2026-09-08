import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApplicationsController } from './applications.controller.js';
import { ApplicationsService } from './applications.service.js';
import { Application } from './entities/application.entity.js';
import { Job } from '../jobs/entities/job.entity.js';
import { Company } from '../companies/entities/company.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Application, Job, Company])],
  controllers: [ApplicationsController],
  providers: [ApplicationsService],
  exports: [ApplicationsService],
})
export class ApplicationsModule {}
