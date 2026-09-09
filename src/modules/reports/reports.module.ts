import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';
import { DailyReport } from './entities/daily-report.entity.js';
import { SiteEngineerAssignment } from '../site-engineers/entities/site-engineer-assignment.entity.js';
import { AttendanceModule } from '../attendance/attendance.module.js';
import { MaterialsModule } from '../materials/materials.module.js';
import { ExpensesModule } from '../expenses/expenses.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([DailyReport, SiteEngineerAssignment]),
    AttendanceModule,
    MaterialsModule,
    ExpensesModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
