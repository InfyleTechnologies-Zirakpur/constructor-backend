import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Attendance } from '../attendance/entities/attendance.entity.js';
import { DailyReport } from '../reports/entities/daily-report.entity.js';

@Injectable()
export class SitesService {
  constructor(
    @InjectRepository(Attendance)
    private readonly attendanceRepository: Repository<Attendance>,
    @InjectRepository(DailyReport)
    private readonly dailyReportRepository: Repository<DailyReport>,
  ) {}

  async checkIn(siteId: string, userId: string) {
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const record = this.attendanceRepository.create({
      siteId,
      userId,
      date: dateStr,
      checkInTime: today,
      status: 'present',
    });

    return this.attendanceRepository.save(record);
  }

  async createDailyReport(siteId: string, dto: Partial<DailyReport>) {
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const totalLabourCost = Number(dto.totalLabourCost ?? 0);
    const totalMaterialCost = Number(dto.totalMaterialCost ?? 0);
    const totalExpense = Number(dto.totalExpense ?? 0);
    const estimatedProfit = Number(dto.estimatedProfit ?? 0);

    const report = this.dailyReportRepository.create({
      siteId,
      date: dateStr,
      totalLabourCost,
      totalMaterialCost,
      totalExpense,
      estimatedProfit,
      status: 'draft',
    });

    return this.dailyReportRepository.save(report);
  }
}
