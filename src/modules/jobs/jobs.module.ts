import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobsController } from './jobs.controller.js';
import { JobsService } from './jobs.service.js';
import { Job } from './entities/job.entity.js';
import { SavedJob } from './entities/saved-job.entity.js';
import { Company } from '../companies/entities/company.entity.js';
import { User } from '../users/entities/user.entity.js';
import { Application } from '../applications/entities/application.entity.js';
import { ApplicationsModule } from '../applications/applications.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Job, Company, SavedJob, Application, User]),
    ApplicationsModule,
    NotificationsModule,
  ],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
