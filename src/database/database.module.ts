import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../modules/users/entities/user.entity.js';
import { Company } from '../modules/companies/entities/company.entity.js';
import { Contractor } from '../modules/contractors/entities/contractor.entity.js';
import { Project } from '../modules/projects/entities/project.entity.js';
import { ProjectSite } from '../modules/project-sites/entities/project-site.entity.js';
import { SiteEngineerAssignment } from '../modules/site-engineers/entities/site-engineer-assignment.entity.js';
import { Job } from '../modules/jobs/entities/job.entity.js';
import { SavedJob } from '../modules/jobs/entities/saved-job.entity.js';
import { Application } from '../modules/applications/entities/application.entity.js';
import { Attendance } from '../modules/attendance/entities/attendance.entity.js';
import { LabourRecord } from '../modules/attendance/entities/labour-record.entity.js';
import { Material } from '../modules/materials/entities/material.entity.js';
import { MaterialTransaction } from '../modules/materials/entities/material-transaction.entity.js';
import { Expense } from '../modules/expenses/entities/expense.entity.js';
import { DailyReport } from '../modules/reports/entities/daily-report.entity.js';
import { Document } from '../modules/documents/entities/document.entity.js';
import { Notification } from '../modules/notifications/entities/notification.entity.js';
import { AuditLog } from '../modules/audit-logs/entities/audit-log.entity.js';
import { DeviceToken } from '../modules/notifications/entities/device-token.entity.js';

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/construction_db';

const entities = [
  User,
  Company,
  Contractor,
  Project,
  ProjectSite,
  SiteEngineerAssignment,
  Job,
  SavedJob,
  Application,
  Attendance,
  LabourRecord,
  Material,
  MaterialTransaction,
  Expense,
  DailyReport,
  Document,
  Notification,
  AuditLog,
  DeviceToken,
];

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: databaseUrl,
      entities,
      synchronize: process.env.NODE_ENV !== 'production',
      logging: process.env.NODE_ENV === 'development',
    }),
    TypeOrmModule.forFeature(entities),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
