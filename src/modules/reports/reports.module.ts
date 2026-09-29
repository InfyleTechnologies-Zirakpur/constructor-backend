import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';
import { DailyReport } from './entities/daily-report.entity.js';
import { ReportExport } from './entities/report-export.entity.js';
import { SiteEngineerAssignment } from '../site-engineers/entities/site-engineer-assignment.entity.js';
import { Project } from '../projects/entities/project.entity.js';
import { ProjectSite } from '../project-sites/entities/project-site.entity.js';
import { Contractor } from '../contractors/entities/contractor.entity.js';
import { Attendance } from '../attendance/entities/attendance.entity.js';
import { LabourRecord } from '../attendance/entities/labour-record.entity.js';
import { Material } from '../materials/entities/material.entity.js';
import { MaterialTransaction } from '../materials/entities/material-transaction.entity.js';
import { Expense } from '../expenses/entities/expense.entity.js';
import { User } from '../users/entities/user.entity.js';
import { Company } from '../companies/entities/company.entity.js';
import { Job } from '../jobs/entities/job.entity.js';
import { Application } from '../applications/entities/application.entity.js';
import { AttendanceModule } from '../attendance/attendance.module.js';
import { MaterialsModule } from '../materials/materials.module.js';
import { ExpensesModule } from '../expenses/expenses.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DailyReport,
      ReportExport,
      SiteEngineerAssignment,
      Project,
      ProjectSite,
      Contractor,
      Attendance,
      LabourRecord,
      Material,
      MaterialTransaction,
      Expense,
      User,
      Company,
      Job,
      Application,
    ]),
    AttendanceModule,
    MaterialsModule,
    ExpensesModule,
    NotificationsModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
