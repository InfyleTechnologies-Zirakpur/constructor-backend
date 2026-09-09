import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service.js';
import {
  CheckInDto,
  CheckOutDto,
  CreateLabourRecordDto,
} from './dto/create-attendance.dto.js';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';

@Controller()
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  // ─── WORKER APP ROUTES ────────────────────────────

  /**
   * POST /attendance/check-in — Worker checks in (Flutter app contract).
   */
  @Post('attendance/check-in')
  @Roles('job_seeker', 'site_engineer')
  async checkIn(@Req() req: any, @Body() dto: CheckInDto) {
    const data = await this.attendanceService.checkIn(req.user.id, dto);
    return { success: true, message: 'Checked in successfully', data };
  }

  /**
   * POST /attendance/check-out — Worker checks out.
   */
  @Post('attendance/check-out')
  @Roles('job_seeker', 'site_engineer')
  async checkOut(@Req() req: any, @Body() dto: CheckOutDto) {
    const data = await this.attendanceService.checkOut(req.user.id, dto);
    return { success: true, message: 'Checked out successfully', data };
  }

  /**
   * GET /attendance — List attendance history (supports ?month=YYYY-MM).
   */
  @Get('attendance')
  @Roles('admin', 'contractor', 'job_seeker', 'site_engineer')
  async list(
    @Req() req: any,
    @Query('month') month?: string,
    @Query('siteId') siteId?: string,
  ) {
    const result = await this.attendanceService.list(
      req.user.id,
      req.user.role,
      month,
      siteId,
    );
    return { success: true, data: result };
  }

  /**
   * GET /attendance/:id — Get single attendance record.
   */
  @Get('attendance/:id')
  @Roles('admin', 'contractor', 'job_seeker', 'site_engineer')
  async getById(@Req() req: any, @Param('id') id: string) {
    const data = await this.attendanceService.getById(
      id,
      req.user.id,
      req.user.role,
    );
    return { success: true, data };
  }

  // ─── CONTRACTOR ERP ROUTES ────────────────────────

  /**
   * POST /sites/:siteId/attendance/check-in — Check-in at a specific site (ERP).
   */
  @Post('sites/:siteId/attendance/check-in')
  @Roles('site_engineer', 'contractor', 'admin')
  async siteCheckIn(
    @Req() req: any,
    @Param('siteId') siteId: string,
    @Body() dto: CheckInDto,
  ) {
    dto.siteId = siteId;
    const data = await this.attendanceService.checkIn(req.user.id, dto);
    return { success: true, message: 'Checked in successfully', data };
  }

  /**
   * POST /sites/:siteId/attendance/check-out — Check-out from a specific site (ERP).
   */
  @Post('sites/:siteId/attendance/check-out')
  @Roles('site_engineer', 'contractor', 'admin')
  async siteCheckOut(@Req() req: any, @Body() dto: CheckOutDto) {
    const data = await this.attendanceService.checkOut(req.user.id, dto);
    return { success: true, message: 'Checked out successfully', data };
  }

  /**
   * GET /sites/:siteId/attendance — View attendance for a specific site.
   */
  @Get('sites/:siteId/attendance')
  @Roles('admin', 'contractor', 'site_engineer')
  async siteAttendance(
    @Param('siteId') siteId: string,
    @Query('date') date?: string,
  ) {
    const data = await this.attendanceService.getSiteAttendance(siteId, date);
    return { success: true, data };
  }

  // ─── LABOUR RECORDS ───────────────────────────────

  /**
   * POST /sites/:siteId/labour — Create a labour record for a site.
   */
  @Post('sites/:siteId/labour')
  @Roles('site_engineer', 'contractor', 'admin')
  async createLabourRecord(
    @Req() req: any,
    @Param('siteId') siteId: string,
    @Body() dto: CreateLabourRecordDto,
  ) {
    dto.siteId = siteId;
    const record = await this.attendanceService.createLabourRecord(
      req.user.id,
      req.user.role,
      dto,
    );
    return {
      success: true,
      message: 'Labour record created',
      data: record,
    };
  }

  /**
   * GET /sites/:siteId/labour — Get labour records for a site.
   */
  @Get('sites/:siteId/labour')
  @Roles('admin', 'contractor', 'site_engineer')
  async getLabourRecords(
    @Param('siteId') siteId: string,
    @Query('date') date?: string,
  ) {
    const result = await this.attendanceService.getLabourRecords(siteId, date);
    return { success: true, data: result };
  }
}
