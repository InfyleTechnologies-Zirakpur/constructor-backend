/**
 * One-off schema initializer for a FRESH database (e.g. new CockroachDB cluster).
 * Creates all tables from the TypeORM entities, then exits.
 *
 * Usage: npm run db:init
 */
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

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

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL is not set — add your CockroachDB URL to .env first.');
  process.exit(1);
}

// CockroachDB SSL — same logic as database.module.ts
const useSsl =
  databaseUrl.includes('sslmode=') || databaseUrl.includes('cockroachlabs.cloud');
let ssl: any = undefined;
if (useSsl) {
  const certPath = process.env.APPDATA
    ? path.join(process.env.APPDATA, 'postgresql', 'root.crt')
    : path.join(process.cwd(), 'certs', 'root.crt');
  ssl = fs.existsSync(certPath)
    ? { rejectUnauthorized: true, ca: fs.readFileSync(certPath).toString() }
    : { rejectUnauthorized: true };
}

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

async function run() {
  console.log('Connecting to database...');
  const dataSource = new DataSource({
    type: 'postgres',
    url: databaseUrl,
    ...(ssl ? { ssl } : {}),
    entities,
    synchronize: true, // creates missing tables/columns on a fresh DB
    logging: false,
  });

  await dataSource.initialize();
  console.log('Schema synchronized — all tables created.');

  const tableRes = await dataSource.query(
    `SELECT count(*) AS tables FROM information_schema.tables WHERE table_schema = 'public'`,
  );
  console.log(`Tables in public schema: ${tableRes[0]?.tables}`);

  await dataSource.destroy();
  console.log('Done. Now run: npm run seed');
}

run().catch((err) => {
  console.error('Schema init failed:', err);
  process.exit(1);
});
