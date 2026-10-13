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
import { ReportExport } from '../modules/reports/entities/report-export.entity.js';
import { Document } from '../modules/documents/entities/document.entity.js';
import { Notification } from '../modules/notifications/entities/notification.entity.js';
import { AuditLog } from '../modules/audit-logs/entities/audit-log.entity.js';
import { DeviceToken } from '../modules/notifications/entities/device-token.entity.js';
import { Conversation } from '../modules/conversations/entities/conversation.entity.js';
import { Message } from '../modules/conversations/entities/message.entity.js';
import { Post } from '../modules/posts/entities/post.entity.js';
import { PostComment } from '../modules/posts/entities/post-comment.entity.js';
import { PostLike } from '../modules/posts/entities/post-like.entity.js';
import { Worker } from '../modules/workers/entities/worker.entity.js';
import { Payment } from '../modules/payments/entities/payment.entity.js';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigModule, ConfigService } from '@nestjs/config';
// @ts-ignore - pg types declared in src/types/pg.d.ts
import { types as pgTypes } from 'pg';

// CockroachDB maps integer types to INT8 (64-bit integer, OID 20).
// By default, node-pg returns INT8 as string to prevent 64-bit precision loss.
// This causes arithmetic operations (+ 1) to perform string concatenation ("1" + 1 -> "11"),
// eventually overflowing 64-bit integers with 20 digits ("11111111111111111111").
// Parsing INT8 as a JavaScript number prevents this issue.
pgTypes.setTypeParser(20, (val: string) => parseInt(val, 10));

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/construction_db';
if (!databaseUrl) throw new Error('DATABASE_URL is not set');

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
  ReportExport,
  Document,
  Notification,
  AuditLog,
  DeviceToken,
  Conversation,
  Message,
  Post,
  PostComment,
  PostLike,
  Worker,
  Payment,
];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('DATABASE_URL');
        if (!url) throw new Error('DATABASE_URL is not set');

        // FIX: synchronize:false — auto-ALTER on every `npm start` was
        // spamming "SELECT ... ALTER TABLE users ADD ..." and hanging on CockroachDB.
        // Use migrations for schema changes instead.
        const shouldSync =
          process.env.DB_SYNC === 'true' || process.env.TYPEORM_SYNC === 'true';
        // Render (Linux) has no APPDATA, and Cockroach DATABASE_URL already has ?sslmode=verify-full
        // — so don't crash on path.join(undefined). Try to read root.crt if present, else no explicit ssl.
        const useSsl =
          url.includes('sslmode=') || url.includes('cockroachlabs.cloud');
        let ssl: any = undefined;
        if (useSsl) {
          try {
            const certPath = process.env.APPDATA
              ? path.join(process.env.APPDATA, 'postgresql', 'root.crt')
              : path.join(process.cwd(), 'certs', 'root.crt');
            if (fs.existsSync(certPath)) {
              ssl = {
                rejectUnauthorized: true,
                ca: fs.readFileSync(certPath).toString(),
              };
            } else {
              ssl = { rejectUnauthorized: true };
            }
          } catch {
            ssl = { rejectUnauthorized: true };
          }
        }

        return {
          type: 'postgres' as const,
          url,
          ...(ssl ? { ssl } : {}),
          entities,
          synchronize: shouldSync, // default false — set DB_SYNC=true only for one-off local init
          logging: false, // was `development` → flooded terminal with query: SELECT ... / ALTER TABLE
        };
      },
    }),
    TypeOrmModule.forFeature(entities),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
