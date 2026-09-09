import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Attendance } from './entities/attendance.entity.js';
import { LabourRecord } from './entities/labour-record.entity.js';
import { SiteEngineerAssignment } from '../site-engineers/entities/site-engineer-assignment.entity.js';
import {
  CheckInDto,
  CreateLabourRecordDto,
} from './dto/create-attendance.dto.js';
import { CheckOutDto } from './dto/create-attendance.dto.js';

@Injectable()
export class AttendanceService {
  /** Standard working day = 8 hours = 480 minutes */
  private readonly STANDARD_DAY_MINUTES = 480;

  constructor(
    @InjectRepository(Attendance)
    private readonly attendanceRepo: Repository<Attendance>,

    @InjectRepository(LabourRecord)
    private readonly labourRepo: Repository<LabourRecord>,

    @InjectRepository(SiteEngineerAssignment)
    private readonly assignmentRepo: Repository<SiteEngineerAssignment>,
  ) {}

  // ─── CHECK-IN ─────────────────────────────────────

  async checkIn(
    userId: string,
    dto: CheckInDto,
  ): Promise<Record<string, unknown>> {
    const today = this.todayString();

    // Prevent duplicate check-in for the same day
    const existing = await this.attendanceRepo.findOne({
      where: { userId, date: today },
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

    const attendance = this.attendanceRepo.create({
      userId,
      siteId: dto.siteId || undefined,
      date: today,
      checkInTime: new Date(),
      checkInLatitude: dto.latitude,
      checkInLongitude: dto.longitude,
      status: 'present',
    });

    const saved = await this.attendanceRepo.save(attendance);
    return this.formatAttendanceResponse(saved as Attendance);
  }

  // ─── CHECK-OUT ────────────────────────────────────

  async checkOut(
    userId: string,
    dto: CheckOutDto,
  ): Promise<Record<string, unknown>> {
    const today = this.todayString();

    const attendance = await this.attendanceRepo.findOne({
      where: { userId, date: today },
    });

    if (!attendance || !attendance.checkInTime) {
      throw new BadRequestException(
        'No open check-in found. Please check in first.',
      );
    }

    if (attendance.checkOutTime) {
      throw new ConflictException('You have already checked out today.');
    }

    const checkOutTime = new Date();
    const diffMs = checkOutTime.getTime() - attendance.checkInTime.getTime();
    const totalMinutes = Math.floor(diffMs / 60000);
    const overtimeMinutes = Math.max(
      0,
      totalMinutes - this.STANDARD_DAY_MINUTES,
    );

    attendance.checkOutTime = checkOutTime;
    attendance.checkOutLatitude = dto.latitude;
    attendance.checkOutLongitude = dto.longitude;
    attendance.totalMinutes = totalMinutes;
    attendance.overtimeMinutes = overtimeMinutes;

    const saved = await this.attendanceRepo.save(attendance);
    return this.formatAttendanceResponse(saved);
  }

  // ─── ATTENDANCE LIST ──────────────────────────────

  async list(userId: string, role: string, month?: string, siteId?: string) {
    const query = this.attendanceRepo.createQueryBuilder('att');

    if (role === 'job_seeker' || role === 'site_engineer') {
      query.where('att.userId = :userId', { userId });
    } else if (role === 'contractor') {
      // Contractor sees attendance for their assigned sites
      const assignments = await this.assignmentRepo.find({
        where: { isActive: true },
        select: { siteId: true },
      });
      const siteIds = assignments.map((a) => a.siteId);
      if (siteIds.length > 0) {
        query.where('att.siteId IN (:...siteIds)', { siteIds });
      } else {
        return { items: [], summary: { days: 0, overtime: '0h' } };
      }
    }
    // Admin sees all

    if (siteId) {
      query.andWhere('att.siteId = :siteId', { siteId });
    }

    if (month) {
      // month format: YYYY-MM
      const [year, mon] = month.split('-').map(Number);
      const startDate = `${year}-${String(mon).padStart(2, '0')}-01`;
      const lastDay = new Date(year, mon, 0).getDate();
      const endDate = `${year}-${String(mon).padStart(2, '0')}-${lastDay}`;
      query.andWhere('att.date BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      });
    }

    query.orderBy('att.date', 'DESC');
    const records = await query.getMany();

    const items = records.map((r) => this.formatAttendanceResponse(r));

    // Summary
    const totalDays = records.filter(
      (r) => r.status === 'present' || r.status === 'half_day',
    ).length;
    const totalOvertimeMinutes = records.reduce(
      (sum, r) => sum + r.overtimeMinutes,
      0,
    );

    return {
      items,
      summary: {
        days: totalDays,
        overtime: this.formatDuration(totalOvertimeMinutes),
      },
    };
  }

  // ─── GET SINGLE ATTENDANCE ────────────────────────

  async getById(id: string, userId: string, role: string) {
    const attendance = await this.attendanceRepo.findOne({
      where: { id },
      relations: { site: true },
    });

    if (!attendance) {
      throw new NotFoundException('Attendance record not found');
    }

    if (
      (role === 'job_seeker' || role === 'site_engineer') &&
      attendance.userId !== userId
    ) {
      throw new ForbiddenException('You can only view your own attendance');
    }

    return this.formatAttendanceResponse(attendance);
  }

  // ─── SITE ATTENDANCE (ERP) ────────────────────────

  async getSiteAttendance(siteId: string, date?: string) {
    const query = this.attendanceRepo.createQueryBuilder('att');
    query.where('att.siteId = :siteId', { siteId });

    if (date) {
      query.andWhere('att.date = :date', { date });
    }

    query.leftJoinAndSelect('att.user', 'user');
    query.orderBy('att.date', 'DESC');
    const records = await query.getMany();

    return records.map((r) => ({
      ...this.formatAttendanceResponse(r),
      worker: r.user
        ? {
            id: r.user.id,
            fullName: r.user.fullName,
            phone: r.user.phone,
          }
        : undefined,
    }));
  }

  // ─── LABOUR RECORDS ───────────────────────────────

  async createLabourRecord(
    userId: string,
    role: string,
    dto: CreateLabourRecordDto,
  ): Promise<LabourRecord> {
    if (role === 'site_engineer') {
      await this.verifySiteAccess(dto.siteId, userId);
    }

    // Server-side cost calculation
    const baseCost = dto.headcount * dto.dailyWage;
    const overtimeCost = (dto.overtimeHours || 0) * (dto.overtimeRate || 0);
    const totalCost = baseCost + overtimeCost;

    const record = this.labourRepo.create({
      siteId: dto.siteId,
      date: dto.date,
      headcount: dto.headcount,
      category: dto.category,
      dailyWage: dto.dailyWage,
      overtimeHours: dto.overtimeHours || 0,
      overtimeRate: dto.overtimeRate || 0,
      totalCost,
      remarks: dto.remarks,
    });

    return this.labourRepo.save(record);
  }

  async getLabourRecords(siteId: string, date?: string) {
    const where: Record<string, unknown> = { siteId };
    if (date) where.date = date;

    const records = await this.labourRepo.find({
      where,
      order: { date: 'DESC' },
    });

    // Calculate summary
    const totalCost = records.reduce((sum, r) => sum + Number(r.totalCost), 0);
    const totalHeadcount = records.reduce((sum, r) => sum + r.headcount, 0);

    return {
      items: records,
      summary: {
        totalRecords: records.length,
        totalHeadcount,
        totalCost: Number(totalCost.toFixed(2)),
      },
    };
  }

  /**
   * Get total labour cost for a site (feeds into daily cost calculation).
   */
  async getSiteLabourCost(siteId: string, date?: string): Promise<number> {
    const query = this.labourRepo
      .createQueryBuilder('lr')
      .select('SUM(lr.totalCost)', 'total')
      .where('lr.siteId = :siteId', { siteId });

    if (date) {
      query.andWhere('lr.date = :date', { date });
    }

    const result = await query.getRawOne();
    return Number(result?.total ?? 0);
  }

  // ─── HELPERS ──────────────────────────────────────

  private todayString(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /**
   * Format an attendance record to match the Flutter app contract.
   */
  private formatAttendanceResponse(att: Attendance): Record<string, unknown> {
    return {
      id: att.id,
      date: att.date,
      checkIn: att.checkInTime ? this.formatTime(att.checkInTime) : null,
      checkOut: att.checkOutTime ? this.formatTime(att.checkOutTime) : null,
      hours: this.formatDuration(att.totalMinutes),
      overtime: this.formatDuration(att.overtimeMinutes),
      status: att.status,
    };
  }

  private formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  private formatDuration(totalMinutes: number): string {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h}h ${String(m).padStart(2, '0')}m`;
  }

  private async verifySiteAccess(
    siteId: string,
    userId: string,
  ): Promise<void> {
    const assignment = await this.assignmentRepo.findOne({
      where: { siteId, userId, isActive: true },
    });
    if (!assignment) {
      throw new ForbiddenException('You are not assigned to this site');
    }
  }
}
