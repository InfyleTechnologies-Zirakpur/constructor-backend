import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkerAppController } from './worker-app.controller.js';
import { WorkerAppService } from './worker-app.service.js';
import { User } from '../users/entities/user.entity.js';
import { Job } from '../jobs/entities/job.entity.js';
import { SavedJob } from '../jobs/entities/saved-job.entity.js';
import { Application } from '../applications/entities/application.entity.js';
import { Attendance } from '../attendance/entities/attendance.entity.js';
import { Notification } from '../notifications/entities/notification.entity.js';
import { Document } from '../documents/entities/document.entity.js';
import { Company } from '../companies/entities/company.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Job,
      SavedJob,
      Application,
      Attendance,
      Notification,
      Document,
      Company,
    ]),
  ],
  controllers: [WorkerAppController],
  providers: [WorkerAppService],
})
export class WorkerAppModule {}
