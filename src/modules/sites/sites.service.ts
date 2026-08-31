import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Attendance } from '../attendance/entities/attendance.entity.js';
import { DailyReport } from '../reports/entities/daily-report.entity.js';

export type AttendanceStatus = 'checked_in' | 'checked_out';

@Injectable()
export class SitesService {
  constructor(
    @InjectRepository(Attendance)
    private readonly attendanceRepository: Repository<Attendance>,
    @InjectRepository(DailyReport)
    private readonly dailyReportRepository: Repository<DailyReport>,
  ) {}

  async checkIn(siteId: string, dto: Partial<Attendance>) {
    const record = this.attendanceRepository.create({
      siteId,
      workerName: dto.workerName ?? 'Unknown Worker',
      date: new Date(),
      status: 'checked_in',
    });

    return this.attendanceRepository.save(record);
  }

  async createDailyReport(siteId: string, dto: Partial<DailyReport>) {
    const totalLabourCost = Number(dto.totalLabourCost ?? 0);
    const totalMaterialCost = Number(dto.totalMaterialCost ?? 0);
    const totalExpense = Number(dto.totalExpense ?? 0);
    const estimatedProfit = Number(dto.estimatedProfit ?? 0);

    const report = this.dailyReportRepository.create({
      siteId,
      date: new Date(),
      totalLabourCost,
      totalMaterialCost,
      totalExpense,
      estimatedProfit,
      status: 'draft',
    });

    return this.dailyReportRepository.save(report);
  }
}
