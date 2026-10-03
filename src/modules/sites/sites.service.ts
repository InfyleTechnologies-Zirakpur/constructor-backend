import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
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

  async checkIn(
    siteId: string,
    userOrDto:
      | string
      | {
          userId?: string;
          workerId?: string;
          latitude?: number;
          longitude?: number;
          checkInLatitude?: number;
          checkInLongitude?: number;
          [key: string]: any;
        },
  ) {
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    let userId: string | undefined;
    let latitude: number | undefined;
    let longitude: number | undefined;

    if (typeof userOrDto === 'string') {
      userId = userOrDto;
    } else if (typeof userOrDto === 'object' && userOrDto !== null) {
      userId = userOrDto.userId || userOrDto.workerId;
      latitude = userOrDto.latitude ?? userOrDto.checkInLatitude;
      longitude = userOrDto.longitude ?? userOrDto.checkInLongitude;
    }

    if (!userId || typeof userId !== 'string') {
      throw new BadRequestException('User ID is required for check-in');
    }

    // Prevent duplicate check-in for the same day
    const existing = await this.attendanceRepository.findOne({
      where: { userId, date: dateStr },
    });

    if (existing && existing.checkInTime && !existing.checkOutTime) {
      throw new ConflictException(
        'You are already checked in. Please check out first.',
      );
    }

    if (existing && existing.checkOutTime) {
      throw new ConflictException(
        'You have already completed attendance for today.',
      );
    }

    const record = this.attendanceRepository.create({
      siteId,
      userId,
      date: dateStr,
      checkInTime: today,
      checkInLatitude: latitude,
      checkInLongitude: longitude,
      status: 'present',
    });

    return this.attendanceRepository.save(record);
  }

  async createDailyReport(
    siteId: string,
    dto: Partial<DailyReport> & { userId?: string; submittedById?: string },
  ) {
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const totalLabourCost = Number(dto.totalLabourCost ?? 0);
    const totalMaterialCost = Number(dto.totalMaterialCost ?? 0);
    const totalExpense = Number(dto.totalExpense ?? 0);
    const estimatedProfit = Number(dto.estimatedProfit ?? 0);
    const submittedById = dto.submittedById || dto.userId;

    const report = this.dailyReportRepository.create({
      siteId,
      submittedById,
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
