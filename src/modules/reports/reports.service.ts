import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DailyReport } from './entities/daily-report.entity.js';
import { SiteEngineerAssignment } from '../site-engineers/entities/site-engineer-assignment.entity.js';
import { AttendanceService } from '../attendance/attendance.service.js';
import { MaterialsService } from '../materials/materials.service.js';
import { ExpensesService } from '../expenses/expenses.service.js';
import { CreateDailyReportDto } from './dto/create-reports.dto.js';
import { UpdateReportStatusDto } from './dto/update-reports.dto.js';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(DailyReport)
    private readonly reportRepo: Repository<DailyReport>,

    @InjectRepository(SiteEngineerAssignment)
    private readonly assignmentRepo: Repository<SiteEngineerAssignment>,

    private readonly attendanceService: AttendanceService,
    private readonly materialsService: MaterialsService,
    private readonly expensesService: ExpensesService,
  ) {}

  // ═══════════════════════════════════════════════════
  //  CREATE DAILY REPORT
  // ═══════════════════════════════════════════════════

  /**
   * Create a daily report for a site.
   * Server-side aggregation:
   *   Daily Project Cost = Labour Cost + Material Cost + Site Expenses + Other Costs
   *   Estimated Daily Profit = Daily Revenue - Daily Project Cost
   */
  async createDailyReport(
    siteId: string,
    userId: string,
    role: string,
    dto: CreateDailyReportDto,
  ): Promise<DailyReport> {
    if (role === 'site_engineer') {
      await this.verifySiteAccess(siteId, userId);
    }

    // Check for duplicate report on same site+date
    const existing = await this.reportRepo.findOne({
      where: { siteId, date: dto.date },
    });
    if (existing) {
      throw new BadRequestException(
        'A daily report already exists for this site and date',
      );
    }

    // ── Server-side cost aggregation ──
    const [labourCost, materialCost, expenseCost] = await Promise.all([
      this.attendanceService.getSiteLabourCost(siteId, dto.date),
      this.materialsService.getSiteMaterialCost(siteId, dto.date),
      this.expensesService.getSiteExpenseCost(siteId, dto.date),
    ]);

    const otherCosts = dto.otherCosts ?? 0;
    const totalDailyCost = labourCost + materialCost + expenseCost + otherCosts;
    const dailyRevenue = dto.dailyRevenue ?? 0;
    const estimatedProfit = dailyRevenue - totalDailyCost;

    const report = this.reportRepo.create({
      siteId,
      date: dto.date,
      totalLabourCost: labourCost,
      totalMaterialCost: materialCost,
      totalExpense: expenseCost,
      otherCosts,
      totalDailyCost,
      dailyRevenue,
      estimatedProfit,
      progressPercentage: dto.progressPercentage ?? 0,
      workCompleted: dto.workCompleted,
      remarks: dto.remarks,
      attachmentUrls: dto.attachmentUrls,
      submittedById: userId,
      status: 'draft',
    });

    return this.reportRepo.save(report);
  }

  // ═══════════════════════════════════════════════════
  //  SUBMIT / REVIEW (Status Transitions)
  // ═══════════════════════════════════════════════════

  /**
   * Update report status: Draft → Submitted → Reviewed.
   */
  async updateReportStatus(
    reportId: string,
    userId: string,
    role: string,
    dto: UpdateReportStatusDto,
  ): Promise<DailyReport> {
    const report = await this.reportRepo.findOne({
      where: { id: reportId },
    });
    if (!report) throw new NotFoundException('Report not found');

    // Validate transition
    if (dto.status === 'submitted') {
      if (report.status !== 'draft') {
        throw new BadRequestException('Only draft reports can be submitted');
      }
      if (role === 'site_engineer') {
        await this.verifySiteAccess(report.siteId, userId);
      }

      // Re-aggregate costs on submission to ensure latest data
      const [labourCost, materialCost, expenseCost] = await Promise.all([
        this.attendanceService.getSiteLabourCost(report.siteId, report.date),
        this.materialsService.getSiteMaterialCost(report.siteId, report.date),
        this.expensesService.getSiteExpenseCost(report.siteId, report.date),
      ]);

      report.totalLabourCost = labourCost;
      report.totalMaterialCost = materialCost;
      report.totalExpense = expenseCost;
      report.totalDailyCost =
        labourCost + materialCost + expenseCost + Number(report.otherCosts);
      report.estimatedProfit =
        Number(report.dailyRevenue) - report.totalDailyCost;
    } else if (dto.status === 'reviewed') {
      if (report.status !== 'submitted') {
        throw new BadRequestException(
          'Only submitted reports can be reviewed',
        );
      }
      // Only admin or contractor can review
      if (role !== 'admin' && role !== 'contractor') {
        throw new ForbiddenException('Only admin or contractor can review');
      }
    }

    report.status = dto.status;
    if (dto.remarks) report.remarks = dto.remarks;

    return this.reportRepo.save(report);
  }

  // ═══════════════════════════════════════════════════
  //  GET / LIST REPORTS
  // ═══════════════════════════════════════════════════

  async getReportById(id: string): Promise<DailyReport> {
    const report = await this.reportRepo.findOne({
      where: { id },
      relations: { site: true },
    });
    if (!report) throw new NotFoundException('Report not found');
    return report;
  }

  /**
   * List daily reports for a site.
   */
  async listSiteReports(siteId: string, status?: string) {
    const query = this.reportRepo
      .createQueryBuilder('r')
      .where('r.siteId = :siteId', { siteId });

    if (status) {
      query.andWhere('r.status = :status', { status });
    }

    query.orderBy('r.date', 'DESC');

    const reports = await query.getMany();
    return { items: reports, total: reports.length };
  }

  /**
   * List all reports for a project (across all sites).
   */
  async listProjectReports(projectId: string, status?: string) {
    const query = this.reportRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.site', 'site')
      .where('site.projectId = :projectId', { projectId });

    if (status) {
      query.andWhere('r.status = :status', { status });
    }

    query.orderBy('r.date', 'DESC');

    const reports = await query.getMany();

    // Project-level cost summary
    const totalLabourCost = reports.reduce(
      (sum, r) => sum + Number(r.totalLabourCost),
      0,
    );
    const totalMaterialCost = reports.reduce(
      (sum, r) => sum + Number(r.totalMaterialCost),
      0,
    );
    const totalExpense = reports.reduce(
      (sum, r) => sum + Number(r.totalExpense),
      0,
    );
    const totalDailyCost = reports.reduce(
      (sum, r) => sum + Number(r.totalDailyCost),
      0,
    );
    const totalRevenue = reports.reduce(
      (sum, r) => sum + Number(r.dailyRevenue),
      0,
    );
    const totalProfit = reports.reduce(
      (sum, r) => sum + Number(r.estimatedProfit),
      0,
    );

    return {
      items: reports,
      summary: {
        totalReports: reports.length,
        totalLabourCost: Number(totalLabourCost.toFixed(2)),
        totalMaterialCost: Number(totalMaterialCost.toFixed(2)),
        totalExpense: Number(totalExpense.toFixed(2)),
        totalDailyCost: Number(totalDailyCost.toFixed(2)),
        totalRevenue: Number(totalRevenue.toFixed(2)),
        totalProfit: Number(totalProfit.toFixed(2)),
      },
    };
  }

  // ─── HELPERS ──────────────────────────────────────

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
