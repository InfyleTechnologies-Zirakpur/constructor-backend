import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobsController } from './jobs.controller.js';
import { JobsService } from './jobs.service.js';
import { Job } from './entities/job.entity.js';
import { Company } from '../companies/entities/company.entity.js';
import { ApplicationsModule } from '../applications/applications.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Job, Company]),
    ApplicationsModule,
  ],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
