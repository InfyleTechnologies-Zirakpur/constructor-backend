import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceController } from './attendance.controller.js';
import { AttendanceService } from './attendance.service.js';
import { Attendance } from './entities/attendance.entity.js';
import { LabourRecord } from './entities/labour-record.entity.js';
import { SiteEngineerAssignment } from '../site-engineers/entities/site-engineer-assignment.entity.js';
import { Contractor } from '../contractors/entities/contractor.entity.js';
import { Project } from '../projects/entities/project.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Attendance,
      LabourRecord,
      SiteEngineerAssignment,
      Contractor,
      Project,
    ]),
  ],
  controllers: [AttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
