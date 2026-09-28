import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { randomUUID } from 'crypto';
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
import { AttendanceService } from '../attendance/attendance.service.js';
import { MaterialsService } from '../materials/materials.service.js';
import { ExpensesService } from '../expenses/expenses.service.js';
import { CreateDailyReportDto } from './dto/create-reports.dto.js';
import { UpdateReportStatusDto } from './dto/update-reports.dto.js';
import {
  CreateExportDto,
  FinancialReportQueryDto,
  OperationalReportQueryDto,
  ProjectReportQueryDto,
  SiteReportQueryDto,
} from './dto/report-query.dto.js';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);
  // In-memory fallback for async export jobs in case database table is not synced
  private readonly inMemoryExports = new Map<string, ReportExport>();

  constructor(
    @InjectRepository(DailyReport)
    private readonly reportRepo: Repository<DailyReport>,

    @InjectRepository(ReportExport)
    private readonly exportRepo: Repository<ReportExport>,

    @InjectRepository(SiteEngineerAssignment)
    private readonly assignmentRepo: Repository<SiteEngineerAssignment>,

    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,

    @InjectRepository(ProjectSite)
    private readonly siteRepo: Repository<ProjectSite>,

    @InjectRepository(Contractor)
    private readonly contractorRepo: Repository<Contractor>,

    @InjectRepository(Attendance)
    private readonly attendanceRepo: Repository<Attendance>,

    @InjectRepository(LabourRecord)
    private readonly labourRepo: Repository<LabourRecord>,

    @InjectRepository(Material)
    private readonly materialRepo: Repository<Material>,

    @InjectRepository(MaterialTransaction)
    private readonly materialTxnRepo: Repository<MaterialTransaction>,

    @InjectRepository(Expense)
    private readonly expenseRepo: Repository<Expense>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,

    @InjectRepository(Job)
    private readonly jobRepo: Repository<Job>,

    @InjectRepository(Application)
    private readonly applicationRepo: Repository<Application>,

    private readonly attendanceService: AttendanceService,
    private readonly materialsService: MaterialsService,
    private readonly expensesService: ExpensesService,
  ) {}

  // ═══════════════════════════════════════════════════
  //  1. DAILY REPORT CRUD & LIFECYCLE (Maintained)
  // ═══════════════════════════════════════════════════

  async createDailyReport(
    siteId: string,
    userId: string,
    role: string,
    dto: CreateDailyReportDto,
  ): Promise<DailyReport> {
    await this.verifySiteAccess(siteId, userId, role);

    const existing = await this.reportRepo.findOne({
      where: { siteId, date: dto.date },
    });
    if (existing) {
      throw new BadRequestException(
        'A daily report already exists for this site and date',
      );
    }

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

  async updateReportStatus(
    reportId: string,
    userId: string,
    role: string,
    dto: UpdateReportStatusDto,
  ): Promise<DailyReport> {
    const report = await this.reportRepo.findOne({ where: { id: reportId } });
    if (!report) throw new NotFoundException('Report not found');

    if (dto.status === 'submitted') {
      if (report.status !== 'draft') {
        throw new BadRequestException('Only draft reports can be submitted');
      }
      await this.verifySiteAccess(report.siteId, userId, role);

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
        throw new BadRequestException('Only submitted reports can be reviewed');
      }
      if (role !== 'admin' && role !== 'contractor') {
        throw new ForbiddenException('Only admin or contractor can review');
      }
    }

    report.status = dto.status;
    if (dto.remarks) report.remarks = dto.remarks;

    return this.reportRepo.save(report);
  }

  async getReportById(id: string): Promise<DailyReport> {
    const report = await this.reportRepo.findOne({
      where: { id },
      relations: { site: true },
    });
    if (!report) throw new NotFoundException('Report not found');
    return report;
  }

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

    const totalLabourCost = reports.reduce((sum, r) => sum + Number(r.totalLabourCost), 0);
    const totalMaterialCost = reports.reduce((sum, r) => sum + Number(r.totalMaterialCost), 0);
    const totalExpense = reports.reduce((sum, r) => sum + Number(r.totalExpense), 0);
    const totalDailyCost = reports.reduce((sum, r) => sum + Number(r.totalDailyCost), 0);
    const totalRevenue = reports.reduce((sum, r) => sum + Number(r.dailyRevenue), 0);
    const totalProfit = reports.reduce((sum, r) => sum + Number(r.estimatedProfit), 0);

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

  // ═══════════════════════════════════════════════════
  //  2. PROJECT REPORTS
  // ═══════════════════════════════════════════════════

  /**
   * Project Summary: High-level overview of project health, costs, revenue, progress, sites.
   */
  async getProjectSummary(projectId: string, userId: string, role: string) {
    const project = await this.verifyProjectAccess(projectId, userId, role);
    const sites = await this.siteRepo.find({ where: { projectId } });
    const siteIds = sites.map((s) => s.id);

    const [labourAgg, materialAgg, expenseAgg, dailyReports] = await Promise.all([
      siteIds.length > 0
        ? this.labourRepo
            .createQueryBuilder('lr')
            .select('COALESCE(SUM(lr.totalCost), 0)', 'total')
            .where('lr.siteId IN (:...siteIds)', { siteIds })
            .getRawOne()
        : { total: 0 },
      siteIds.length > 0
        ? this.materialTxnRepo
            .createQueryBuilder('mt')
            .select('COALESCE(SUM(mt.totalCost), 0)', 'total')
            .where('mt.siteId IN (:...siteIds)', { siteIds })
            .andWhere('mt.type = :type', { type: 'purchase' })
            .getRawOne()
        : { total: 0 },
      siteIds.length > 0
        ? this.expenseRepo
            .createQueryBuilder('e')
            .select('COALESCE(SUM(e.amount), 0)', 'total')
            .where('e.siteId IN (:...siteIds)', { siteIds })
            .getRawOne()
        : { total: 0 },
      siteIds.length > 0
        ? this.reportRepo.find({
            where: { siteId: In(siteIds) },
            order: { date: 'DESC' },
          })
        : [],
    ]);

    const totalLabourCost = Number(labourAgg?.total ?? 0);
    const totalMaterialCost = Number(materialAgg?.total ?? 0);
    const totalExpenseCost = Number(expenseAgg?.total ?? 0);
    const otherCosts = dailyReports.reduce((s, r) => s + Number(r.otherCosts ?? 0), 0);
    const totalProjectCost = totalLabourCost + totalMaterialCost + totalExpenseCost + otherCosts;

    const reportedRevenue = dailyReports.reduce((s, r) => s + Number(r.dailyRevenue ?? 0), 0);
    const totalRevenue = reportedRevenue > 0 ? reportedRevenue : Number(project.contractValue || project.budget);
    const netProfit = totalRevenue - totalProjectCost;
    const profitMarginPercentage = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    const avgProgress =
      dailyReports.length > 0
        ? dailyReports.reduce((sum, r) => sum + Number(r.progressPercentage ?? 0), 0) / dailyReports.length
        : 0;

    return {
      project: {
        id: project.id,
        name: project.name,
        location: project.location,
        status: project.status,
        budget: Number(project.budget),
        contractValue: Number(project.contractValue),
        durationDays: project.durationDays,
        startDate: project.startDate,
        endDate: project.endDate,
      },
      sites: {
        total: sites.length,
        active: sites.filter((s) => s.status === 'active').length,
      },
      costs: {
        labourCost: Number(totalLabourCost.toFixed(2)),
        materialCost: Number(totalMaterialCost.toFixed(2)),
        expenseCost: Number(totalExpenseCost.toFixed(2)),
        otherCosts: Number(otherCosts.toFixed(2)),
        totalCost: Number(totalProjectCost.toFixed(2)),
      },
      profitability: {
        totalRevenue: Number(totalRevenue.toFixed(2)),
        netProfit: Number(netProfit.toFixed(2)),
        profitMarginPercentage: Number(profitMarginPercentage.toFixed(2)),
      },
      progress: {
        averagePercentage: Number(avgProgress.toFixed(1)),
        totalReportsSubmitted: dailyReports.length,
        latestReportDate: dailyReports[0]?.date ?? null,
      },
    };
  }

  /**
   * Project Progress: Overall and site-by-site progress tracking over time.
   */
  async getProjectProgress(projectId: string, userId: string, role: string) {
    const project = await this.verifyProjectAccess(projectId, userId, role);
    const sites = await this.siteRepo.find({ where: { projectId } });
    const siteIds = sites.map((s) => s.id);

    const reports = siteIds.length > 0
      ? await this.reportRepo.find({
          where: { siteId: In(siteIds) },
          order: { date: 'DESC' },
          relations: { site: true },
        })
      : [];

    const siteProgress = sites.map((site) => {
      const siteReports = reports.filter((r) => r.siteId === site.id);
      const latestReport = siteReports[0];
      return {
        siteId: site.id,
        siteName: site.name,
        location: site.location,
        status: site.status,
        currentProgressPercentage: latestReport?.progressPercentage ?? 0,
        lastReportedDate: latestReport?.date ?? null,
        latestWorkCompleted: latestReport?.workCompleted ?? null,
        totalReportsCount: siteReports.length,
      };
    });

    const overallProgress =
      siteProgress.length > 0
        ? siteProgress.reduce((sum, s) => sum + s.currentProgressPercentage, 0) / siteProgress.length
        : 0;

    const timeline = reports.slice(0, 30).map((r) => ({
      date: r.date,
      siteId: r.siteId,
      siteName: r.site?.name ?? 'Site',
      progressPercentage: r.progressPercentage,
      workCompleted: r.workCompleted,
    }));

    return {
      projectId: project.id,
      projectName: project.name,
      overallProgressPercentage: Number(overallProgress.toFixed(1)),
      sites: siteProgress,
      recentTimeline: timeline,
    };
  }

  /**
   * Project Cost: Comprehensive cost breakdown vs allocated budget.
   */
  async getProjectCost(
    projectId: string,
    userId: string,
    role: string,
    query: ProjectReportQueryDto,
  ) {
    const project = await this.verifyProjectAccess(projectId, userId, role);
    const sites = await this.siteRepo.find({ where: { projectId } });
    const siteIds = query.siteId ? [query.siteId] : sites.map((s) => s.id);

    if (siteIds.length === 0) {
      return {
        projectId: project.id,
        budget: Number(project.budget),
        totalSpent: 0,
        remainingBudget: Number(project.budget),
        categories: { labour: 0, materials: 0, expenses: 0, other: 0 },
      };
    }

    const labourQb = this.labourRepo
      .createQueryBuilder('lr')
      .select('COALESCE(SUM(lr.totalCost), 0)', 'total')
      .where('lr.siteId IN (:...siteIds)', { siteIds });

    const materialQb = this.materialTxnRepo
      .createQueryBuilder('mt')
      .select('COALESCE(SUM(mt.totalCost), 0)', 'total')
      .where('mt.siteId IN (:...siteIds)', { siteIds })
      .andWhere('mt.type = :type', { type: 'purchase' });

    const expenseQb = this.expenseRepo
      .createQueryBuilder('e')
      .select('COALESCE(SUM(e.amount), 0)', 'total')
      .where('e.siteId IN (:...siteIds)', { siteIds });

    if (query.startDate) {
      labourQb.andWhere('lr.date >= :startDate', { startDate: query.startDate });
      materialQb.andWhere('mt.date >= :startDate', { startDate: query.startDate });
      expenseQb.andWhere('e.date >= :startDate', { startDate: query.startDate });
    }
    if (query.endDate) {
      labourQb.andWhere('lr.date <= :endDate', { endDate: query.endDate });
      materialQb.andWhere('mt.date <= :endDate', { endDate: query.endDate });
      expenseQb.andWhere('e.date <= :endDate', { endDate: query.endDate });
    }

    const [labourRes, materialRes, expenseRes] = await Promise.all([
      labourQb.getRawOne(),
      materialQb.getRawOne(),
      expenseQb.getRawOne(),
    ]);

    const labourCost = Number(labourRes?.total ?? 0);
    const materialCost = Number(materialRes?.total ?? 0);
    const expenseCost = Number(expenseRes?.total ?? 0);
    const totalSpent = labourCost + materialCost + expenseCost;
    const budget = Number(project.budget);
    const remainingBudget = budget - totalSpent;
    const budgetUtilizationPercentage = budget > 0 ? (totalSpent / budget) * 100 : 0;

    return {
      projectId: project.id,
      projectName: project.name,
      budget,
      totalSpent: Number(totalSpent.toFixed(2)),
      remainingBudget: Number(remainingBudget.toFixed(2)),
      budgetUtilizationPercentage: Number(budgetUtilizationPercentage.toFixed(2)),
      breakdown: {
        labour: Number(labourCost.toFixed(2)),
        materials: Number(materialCost.toFixed(2)),
        expenses: Number(expenseCost.toFixed(2)),
      },
    };
  }

  /**
   * Labour Cost Report: Worker counts, overtime, wage breakdown by trade.
   */
  async getProjectLabourCost(
    projectId: string,
    userId: string,
    role: string,
    query: ProjectReportQueryDto,
  ) {
    await this.verifyProjectAccess(projectId, userId, role);
    const sites = await this.siteRepo.find({ where: { projectId } });
    const siteIds = query.siteId ? [query.siteId] : sites.map((s) => s.id);

    if (siteIds.length === 0) {
      return { totalCost: 0, totalWorkers: 0, totalOvertimeHours: 0, trades: [], dailyTrend: [] };
    }

    const qb = this.labourRepo
      .createQueryBuilder('lr')
      .where('lr.siteId IN (:...siteIds)', { siteIds });

    if (query.startDate) qb.andWhere('lr.date >= :startDate', { startDate: query.startDate });
    if (query.endDate) qb.andWhere('lr.date <= :endDate', { endDate: query.endDate });

    const records = await qb.orderBy('lr.date', 'DESC').getMany();

    const totalCost = records.reduce((s, r) => s + Number(r.totalCost), 0);
    const totalWorkers = records.reduce((s, r) => s + Number(r.headcount), 0);
    const totalOvertimeHours = records.reduce((s, r) => s + Number(r.overtimeHours ?? 0), 0);

    // Group by category/trade
    const tradeMap = new Map<string, { headcount: number; totalCost: number }>();
    for (const r of records) {
      const cat = r.category || 'General';
      const existing = tradeMap.get(cat) ?? { headcount: 0, totalCost: 0 };
      existing.headcount += Number(r.headcount);
      existing.totalCost += Number(r.totalCost);
      tradeMap.set(cat, existing);
    }

    const trades = Array.from(tradeMap.entries()).map(([trade, data]) => ({
      trade,
      headcount: data.headcount,
      totalCost: Number(data.totalCost.toFixed(2)),
      percentage: totalCost > 0 ? Number(((data.totalCost / totalCost) * 100).toFixed(1)) : 0,
    }));

    return {
      projectId,
      totalCost: Number(totalCost.toFixed(2)),
      totalWorkers,
      totalOvertimeHours: Number(totalOvertimeHours.toFixed(1)),
      trades,
      recordsCount: records.length,
    };
  }

  /**
   * Material Cost Report: Purchases vs consumption, category breakdown, supplier breakdown.
   */
  async getProjectMaterialCost(
    projectId: string,
    userId: string,
    role: string,
    query: ProjectReportQueryDto,
  ) {
    await this.verifyProjectAccess(projectId, userId, role);
    const sites = await this.siteRepo.find({ where: { projectId } });
    const siteIds = query.siteId ? [query.siteId] : sites.map((s) => s.id);

    if (siteIds.length === 0) {
      return { totalPurchases: 0, totalConsumption: 0, categories: [], topSuppliers: [] };
    }

    const qb = this.materialTxnRepo
      .createQueryBuilder('mt')
      .leftJoinAndSelect('mt.material', 'mat')
      .where('mt.siteId IN (:...siteIds)', { siteIds });

    if (query.startDate) qb.andWhere('mt.date >= :startDate', { startDate: query.startDate });
    if (query.endDate) qb.andWhere('mt.date <= :endDate', { endDate: query.endDate });
    if (query.category) qb.andWhere('mat.category = :cat', { cat: query.category });

    const txns = await qb.orderBy('mt.date', 'DESC').getMany();

    let totalPurchases = 0;
    let totalConsumption = 0;
    const catMap = new Map<string, number>();
    const supplierMap = new Map<string, number>();

    for (const t of txns) {
      const cost = Number(t.totalCost);
      if (t.type === 'purchase') {
        totalPurchases += cost;
        if (t.supplier) {
          supplierMap.set(t.supplier, (supplierMap.get(t.supplier) ?? 0) + cost);
        }
      } else if (t.type === 'consumption') {
        totalConsumption += cost;
      }
      const cat = t.material?.category || 'uncategorized';
      catMap.set(cat, (catMap.get(cat) ?? 0) + cost);
    }

    const categories = Array.from(catMap.entries()).map(([category, amount]) => ({
      category,
      totalCost: Number(amount.toFixed(2)),
    }));

    const topSuppliers = Array.from(supplierMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([supplier, amount]) => ({ supplier, totalAmount: Number(amount.toFixed(2)) }));

    return {
      projectId,
      totalPurchases: Number(totalPurchases.toFixed(2)),
      totalConsumption: Number(totalConsumption.toFixed(2)),
      categories,
      topSuppliers,
      transactionsCount: txns.length,
    };
  }

  /**
   * Expense Summary: Project & site expenses by category.
   */
  async getProjectExpenses(
    projectId: string,
    userId: string,
    role: string,
    query: ProjectReportQueryDto,
  ) {
    await this.verifyProjectAccess(projectId, userId, role);
    const sites = await this.siteRepo.find({ where: { projectId } });
    const siteIds = query.siteId ? [query.siteId] : sites.map((s) => s.id);

    if (siteIds.length === 0) {
      return { totalExpenses: 0, categories: [], expenses: [] };
    }

    const qb = this.expenseRepo
      .createQueryBuilder('e')
      .where('e.siteId IN (:...siteIds)', { siteIds });

    if (query.startDate) qb.andWhere('e.date >= :startDate', { startDate: query.startDate });
    if (query.endDate) qb.andWhere('e.date <= :endDate', { endDate: query.endDate });
    if (query.category) qb.andWhere('e.category = :category', { category: query.category });

    const expenses = await qb.orderBy('e.date', 'DESC').getMany();

    const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
    const catMap = new Map<string, { total: number; count: number }>();
    for (const e of expenses) {
      const existing = catMap.get(e.category) ?? { total: 0, count: 0 };
      existing.total += Number(e.amount);
      existing.count += 1;
      catMap.set(e.category, existing);
    }

    const categories = Array.from(catMap.entries()).map(([category, data]) => ({
      category,
      totalAmount: Number(data.total.toFixed(2)),
      count: data.count,
      percentage: totalExpenses > 0 ? Number(((data.total / totalExpenses) * 100).toFixed(1)) : 0,
    }));

    return {
      projectId,
      totalExpenses: Number(totalExpenses.toFixed(2)),
      categories,
      recentExpenses: expenses.slice(0, 20),
    };
  }

  /**
   * Profitability: Contract Value vs Budget vs Actual Cost, Net Margin.
   */
  async getProjectProfitability(projectId: string, userId: string, role: string) {
    const summary = await this.getProjectSummary(projectId, userId, role);
    const budget = summary.project.budget;
    const contractValue = summary.project.contractValue || budget;
    const actualCost = summary.costs.totalCost;
    const recognizedRevenue = summary.profitability.totalRevenue;
    const netProfit = summary.profitability.netProfit;
    const profitMargin = summary.profitability.profitMarginPercentage;
    const costVariance = budget - actualCost;

    return {
      projectId,
      projectName: summary.project.name,
      financials: {
        contractValue,
        budget,
        actualCost,
        costVariance: Number(costVariance.toFixed(2)),
        isUnderBudget: costVariance >= 0,
      },
      profitability: {
        recognizedRevenue,
        netProfit,
        profitMarginPercentage: profitMargin,
        status: netProfit >= 0 ? 'profitable' : 'loss',
      },
      costDistribution: summary.costs,
    };
  }

  /**
   * Daily Project Reports: Paginated list of daily reports with filters.
   */
  async getProjectDailyReports(
    projectId: string,
    userId: string,
    role: string,
    query: ProjectReportQueryDto,
  ) {
    await this.verifyProjectAccess(projectId, userId, role);
    const sites = await this.siteRepo.find({ where: { projectId } });
    const siteIds = query.siteId ? [query.siteId] : sites.map((s) => s.id);

    if (siteIds.length === 0) {
      return { items: [], total: 0, page: query.page ?? 1, limit: query.limit ?? 20 };
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.reportRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.site', 'site')
      .where('r.siteId IN (:...siteIds)', { siteIds });

    if (query.status) qb.andWhere('r.status = :status', { status: query.status });
    if (query.startDate) qb.andWhere('r.date >= :startDate', { startDate: query.startDate });
    if (query.endDate) qb.andWhere('r.date <= :endDate', { endDate: query.endDate });

    qb.orderBy('r.date', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();

    return { items, total, page, limit };
  }

  // ═══════════════════════════════════════════════════
  //  3. SITE REPORTS
  // ═══════════════════════════════════════════════════

  /**
   * Daily Site Reports with filtering & pagination.
   */
  async getSiteDailyReports(
    siteId: string,
    userId: string,
    role: string,
    query: SiteReportQueryDto,
  ) {
    await this.verifySiteAccess(siteId, userId, role);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.reportRepo
      .createQueryBuilder('r')
      .where('r.siteId = :siteId', { siteId });

    if (query.status) qb.andWhere('r.status = :status', { status: query.status });
    if (query.startDate) qb.andWhere('r.date >= :startDate', { startDate: query.startDate });
    if (query.endDate) qb.andWhere('r.date <= :endDate', { endDate: query.endDate });

    qb.orderBy('r.date', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { siteId, items, total, page, limit };
  }

  /**
   * Site Labour Report: Headcount, wages, overtime for a site.
   */
  async getSiteLabourReport(
    siteId: string,
    userId: string,
    role: string,
    query: SiteReportQueryDto,
  ) {
    await this.verifySiteAccess(siteId, userId, role);

    const qb = this.labourRepo
      .createQueryBuilder('lr')
      .where('lr.siteId = :siteId', { siteId });

    if (query.startDate) qb.andWhere('lr.date >= :startDate', { startDate: query.startDate });
    if (query.endDate) qb.andWhere('lr.date <= :endDate', { endDate: query.endDate });
    if (query.trade) qb.andWhere('lr.category = :trade', { trade: query.trade });

    const records = await qb.orderBy('lr.date', 'DESC').getMany();

    const totalLabourCost = records.reduce((s, r) => s + Number(r.totalCost), 0);
    const totalWorkers = records.reduce((s, r) => s + Number(r.headcount), 0);
    const totalOvertimeHours = records.reduce((s, r) => s + Number(r.overtimeHours ?? 0), 0);

    return {
      siteId,
      totalLabourCost: Number(totalLabourCost.toFixed(2)),
      totalWorkers,
      totalOvertimeHours: Number(totalOvertimeHours.toFixed(1)),
      records,
    };
  }

  /**
   * Site Material Report: Stock on hand, purchases vs consumption.
   */
  async getSiteMaterialReport(
    siteId: string,
    userId: string,
    role: string,
    query: SiteReportQueryDto,
  ) {
    await this.verifySiteAccess(siteId, userId, role);

    const stock = await this.materialsService.getStock(siteId, userId, role);
    const transactions = await this.materialsService.listTransactions(
      siteId,
      userId,
      role,
      query.type,
      undefined,
      query.startDate,
    );

    return { siteId, currentStock: stock, transactions: transactions.items };
  }

  /**
   * Site Expense Report: Detailed expenses for site.
   */
  async getSiteExpenseReport(
    siteId: string,
    userId: string,
    role: string,
    query: SiteReportQueryDto,
  ) {
    await this.verifySiteAccess(siteId, userId, role);

    const qb = this.expenseRepo
      .createQueryBuilder('e')
      .where('e.siteId = :siteId', { siteId });

    if (query.startDate) qb.andWhere('e.date >= :startDate', { startDate: query.startDate });
    if (query.endDate) qb.andWhere('e.date <= :endDate', { endDate: query.endDate });
    if (query.category) qb.andWhere('e.category = :category', { category: query.category });

    const expenses = await qb.orderBy('e.date', 'DESC').getMany();
    const totalAmount = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

    return { siteId, totalAmount: Number(totalAmount.toFixed(2)), expenses };
  }

  /**
   * Site Progress Report: Historical progress curve and recent achievements.
   */
  async getSiteProgressReport(
    siteId: string,
    userId: string,
    role: string,
    query: SiteReportQueryDto,
  ) {
    await this.verifySiteAccess(siteId, userId, role);

    const qb = this.reportRepo
      .createQueryBuilder('r')
      .where('r.siteId = :siteId', { siteId });

    if (query.startDate) qb.andWhere('r.date >= :startDate', { startDate: query.startDate });
    if (query.endDate) qb.andWhere('r.date <= :endDate', { endDate: query.endDate });

    const reports = await qb.orderBy('r.date', 'ASC').getMany();

    const latest = reports[reports.length - 1];
    const curve = reports.map((r) => ({
      date: r.date,
      progressPercentage: r.progressPercentage,
      workCompleted: r.workCompleted,
      remarks: r.remarks,
    }));

    return {
      siteId,
      currentProgressPercentage: latest?.progressPercentage ?? 0,
      latestWorkCompleted: latest?.workCompleted ?? null,
      progressCurve: curve,
    };
  }

  // ═══════════════════════════════════════════════════
  //  4. OPERATIONAL REPORTS
  // ═══════════════════════════════════════════════════

  /**
   * Operational Attendance Report across projects and sites.
   */
  async getAttendanceReport(
    userId: string,
    role: string,
    query: OperationalReportQueryDto,
  ) {
    let siteIds: string[] | undefined;
    if (role === 'contractor') {
      const contractor = await this.contractorRepo.findOne({ where: { userId } });
      if (!contractor) return { totalRecords: 0, totalHours: 0, items: [] };
      const projects = await this.projectRepo.find({ where: { contractorId: contractor.id } });
      const pIds = projects.map((p) => p.id);
      if (pIds.length === 0) return { totalRecords: 0, totalHours: 0, items: [] };
      const sites = await this.siteRepo.find({ where: { projectId: In(pIds) } });
      siteIds = sites.map((s) => s.id);
      if (siteIds.length === 0) return { totalRecords: 0, totalHours: 0, items: [] };
    }

    const qb = this.attendanceRepo.createQueryBuilder('att');
    if (siteIds) qb.where('att.siteId IN (:...siteIds)', { siteIds });
    if (query.siteId) qb.andWhere('att.siteId = :siteId', { siteId: query.siteId });
    if (query.startDate) qb.andWhere('att.date >= :startDate', { startDate: query.startDate });
    if (query.endDate) qb.andWhere('att.date <= :endDate', { endDate: query.endDate });

    const records = await qb.orderBy('att.date', 'DESC').take(100).getMany();

    const totalMinutes = records.reduce((s, r) => s + Number(r.totalMinutes ?? 0), 0);
    const totalOvertimeMinutes = records.reduce((s, r) => s + Number(r.overtimeMinutes ?? 0), 0);

    return {
      totalCheckIns: records.length,
      totalHoursWorked: Number((totalMinutes / 60).toFixed(1)),
      totalOvertimeHours: Number((totalOvertimeMinutes / 60).toFixed(1)),
      recentAttendance: records.slice(0, 25),
    };
  }

  /**
   * Operational Contractor Report: Portfolio metrics for contractors.
   */
  async getContractorReport(
    userId: string,
    role: string,
    query: OperationalReportQueryDto,
  ) {
    const qb = this.contractorRepo
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.user', 'user');

    if (role === 'contractor') {
      qb.where('c.userId = :userId', { userId });
    }

    const contractors = await qb.getMany();
    const projects = await this.projectRepo.find();

    const data = contractors.map((c) => {
      const cProjects = projects.filter((p) => p.contractorId === c.id);
      const totalBudget = cProjects.reduce((s, p) => s + Number(p.budget), 0);
      return {
        contractorId: c.id,
        companyName: c.companyName,
        verificationStatus: c.verificationStatus,
        totalProjects: cProjects.length,
        activeProjects: cProjects.filter((p) => p.status === 'active' || p.status === 'in_progress').length,
        completedProjects: cProjects.filter((p) => p.status === 'completed').length,
        portfolioBudget: Number(totalBudget.toFixed(2)),
      };
    });

    return { items: data, total: data.length };
  }

  /**
   * Operational User Report: User distribution and activity.
   */
  async getUserReport(userId: string, role: string, query: OperationalReportQueryDto) {
    if (role !== 'admin') throw new ForbiddenException('Admin role required');

    const users = await this.userRepo.find();
    const rolesCount: Record<string, number> = {};
    let active = 0;
    let blocked = 0;

    for (const u of users) {
      rolesCount[u.role] = (rolesCount[u.role] ?? 0) + 1;
      if (u.isActive) active += 1;
      if (u.isBlocked) blocked += 1;
    }

    return {
      totalUsers: users.length,
      activeUsers: active,
      blockedUsers: blocked,
      roleDistribution: rolesCount,
    };
  }

  /**
   * Operational Company Report: Verification and job posting metrics.
   */
  async getCompanyReport(userId: string, role: string, query: OperationalReportQueryDto) {
    if (role !== 'admin') throw new ForbiddenException('Admin role required');

    const companies = await this.companyRepo.find();
    const jobs = await this.jobRepo.find();

    const verificationBreakdown = {
      pending: companies.filter((c) => c.verificationStatus === 'pending').length,
      verified: companies.filter((c) => c.verificationStatus === 'verified').length,
      rejected: companies.filter((c) => c.verificationStatus === 'rejected').length,
    };

    return {
      totalCompanies: companies.length,
      verificationBreakdown,
      totalJobsPosted: jobs.length,
    };
  }

  /**
   * Operational Job/Application Report: Job funnel and application velocity.
   */
  async getJobApplicationReport(
    userId: string,
    role: string,
    query: OperationalReportQueryDto,
  ) {
    let companyId: string | undefined;
    if (role === 'company') {
      const company = await this.companyRepo.findOne({ where: { userId } });
      if (!company) return { totalJobs: 0, totalApplications: 0, funnel: {} };
      companyId = company.id;
    }

    const jobsQb = this.jobRepo.createQueryBuilder('j');
    if (companyId) jobsQb.where('j.companyId = :companyId', { companyId });
    const jobs = await jobsQb.getMany();
    const jobIds = jobs.map((j) => j.id);

    if (jobIds.length === 0) {
      return { totalJobs: 0, totalApplications: 0, funnel: {} };
    }

    const apps = await this.applicationRepo.find({ where: { jobId: In(jobIds) } });

    const funnel: Record<string, number> = {};
    for (const a of apps) {
      funnel[a.status] = (funnel[a.status] ?? 0) + 1;
    }

    return {
      totalJobs: jobs.length,
      totalApplications: apps.length,
      averageApplicationsPerJob: jobs.length > 0 ? Number((apps.length / jobs.length).toFixed(1)) : 0,
      funnel,
    };
  }

  // ═══════════════════════════════════════════════════
  //  5. FINANCIAL REPORTS
  // ═══════════════════════════════════════════════════

  /**
   * Financial Cost Report: Across projects or sites.
   */
  async getFinancialCostReport(
    userId: string,
    role: string,
    query: FinancialReportQueryDto,
  ) {
    const projects = await this.getAccessibleProjects(userId, role, query.projectId);
    const projectSummaries = await Promise.all(
      projects.map((p) => this.getProjectCost(p.id, userId, role, query)),
    );

    const totalBudget = projectSummaries.reduce((s, p) => s + p.budget, 0);
    const totalSpent = projectSummaries.reduce((s, p) => s + p.totalSpent, 0);
    const totalRemaining = totalBudget - totalSpent;

    return {
      totalBudget: Number(totalBudget.toFixed(2)),
      totalSpent: Number(totalSpent.toFixed(2)),
      totalRemaining: Number(totalRemaining.toFixed(2)),
      projects: projectSummaries,
    };
  }

  /**
   * Financial Profitability Report: Margin analysis across projects.
   */
  async getFinancialProfitabilityReport(
    userId: string,
    role: string,
    query: FinancialReportQueryDto,
  ) {
    const projects = await this.getAccessibleProjects(userId, role, query.projectId);
    const summaries = await Promise.all(
      projects.map((p) => this.getProjectProfitability(p.id, userId, role)),
    );

    const totalRevenue = summaries.reduce((s, p) => s + p.profitability.recognizedRevenue, 0);
    const totalCost = summaries.reduce((s, p) => s + p.financials.actualCost, 0);
    const netProfit = totalRevenue - totalCost;
    const overallMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    return {
      portfolioFinancials: {
        totalRevenue: Number(totalRevenue.toFixed(2)),
        totalCost: Number(totalCost.toFixed(2)),
        netProfit: Number(netProfit.toFixed(2)),
        overallMarginPercentage: Number(overallMargin.toFixed(2)),
      },
      projectRankings: summaries.sort((a, b) => b.profitability.netProfit - a.profitability.netProfit),
    };
  }

  // ═══════════════════════════════════════════════════
  //  6. EXPORT FUNCTIONALITY (CSV, Excel, PDF)
  // ═══════════════════════════════════════════════════

  /**
   * Create an export job (processed asynchronously/immediately).
   */
  async createExport(userId: string, role: string, dto: CreateExportDto): Promise<ReportExport> {
    const exportId = randomUUID();
    const exportRecord = new ReportExport();
    exportRecord.id = exportId;
    exportRecord.userId = userId;
    exportRecord.reportType = dto.reportType;
    exportRecord.format = dto.format;
    exportRecord.status = 'processing';
    exportRecord.filters = dto.filters ?? {};
    exportRecord.createdAt = new Date();

    // Persist or store in memory
    try {
      await this.exportRepo.save(exportRecord);
    } catch {
      this.inMemoryExports.set(exportId, exportRecord);
    }

    // Process export
    try {
      const data = await this.generateReportData(dto.reportType, dto.filters ?? {}, userId, role);
      const formatted = this.formatExport(data, dto.format, dto.reportType);

      exportRecord.status = 'completed';
      exportRecord.fileName = `${dto.reportType}-${new Date().toISOString().slice(0, 10)}.${dto.format === 'excel' ? 'xls' : dto.format}`;
      exportRecord.fileSizeBytes = Buffer.byteLength(formatted, 'utf-8');
      exportRecord.fileUrl = `/reports/export/${exportId}/download`;
      exportRecord.completedAt = new Date();

      try {
        await this.exportRepo.save(exportRecord);
      } catch {
        this.inMemoryExports.set(exportId, exportRecord);
      }
    } catch (err: any) {
      exportRecord.status = 'failed';
      exportRecord.errorMessage = err.message || 'Export failed';
      try {
        await this.exportRepo.save(exportRecord);
      } catch {
        this.inMemoryExports.set(exportId, exportRecord);
      }
    }

    return exportRecord;
  }

  async listExports(userId: string): Promise<ReportExport[]> {
    try {
      return await this.exportRepo.find({
        where: { userId },
        order: { createdAt: 'DESC' },
      });
    } catch {
      return Array.from(this.inMemoryExports.values()).filter((e) => e.userId === userId);
    }
  }

  async getExportStatus(exportId: string, userId: string): Promise<ReportExport> {
    let exp: ReportExport | null = null;
    try {
      exp = await this.exportRepo.findOne({ where: { id: exportId } });
    } catch {
      exp = this.inMemoryExports.get(exportId) ?? null;
    }
    if (!exp) exp = this.inMemoryExports.get(exportId) ?? null;
    if (!exp) throw new NotFoundException('Export job not found');
    if (exp.userId !== userId) throw new ForbiddenException('Access denied to this export');
    return exp;
  }

  async downloadExport(exportId: string, userId: string) {
    const exp = await this.getExportStatus(exportId, userId);
    if (exp.status !== 'completed') {
      throw new BadRequestException(`Export is ${exp.status}: cannot download yet`);
    }
    const data = await this.generateReportData(exp.reportType, exp.filters ?? {}, userId, 'admin');
    const content = this.formatExport(data, exp.format as any, exp.reportType);
    return {
      fileName: exp.fileName,
      mimeType: this.getMimeType(exp.format),
      content,
    };
  }

  async exportReportDirect(
    reportType: string,
    format: string,
    filters: Record<string, any>,
    userId: string,
    role: string,
  ) {
    const validFormat = ['csv', 'excel', 'pdf'].includes(format) ? format : 'csv';
    const data = await this.generateReportData(reportType, filters, userId, role);
    const content = this.formatExport(data, validFormat as any, reportType);
    const ext = validFormat === 'excel' ? 'xls' : validFormat;
    const fileName = `${reportType}-${new Date().toISOString().slice(0, 10)}.${ext}`;

    return {
      fileName,
      mimeType: this.getMimeType(validFormat),
      content,
    };
  }

  // ═══════════════════════════════════════════════════
  //  INTERNAL HELPERS & FORMATTERS
  // ═══════════════════════════════════════════════════

  private async generateReportData(
    reportType: string,
    filters: Record<string, any>,
    userId: string,
    role: string,
  ): Promise<any> {
    switch (reportType) {
      case 'project-summary':
        return this.getProjectSummary(filters.projectId, userId, role);
      case 'project-cost':
        return this.getProjectCost(filters.projectId, userId, role, filters);
      case 'labour-cost':
        return this.getProjectLabourCost(filters.projectId, userId, role, filters);
      case 'material-cost':
        return this.getProjectMaterialCost(filters.projectId, userId, role, filters);
      case 'expenses':
        return this.getProjectExpenses(filters.projectId, userId, role, filters);
      case 'profitability':
        return this.getProjectProfitability(filters.projectId, userId, role);
      case 'daily-reports':
        return this.getProjectDailyReports(filters.projectId, userId, role, filters);
      case 'site-labour':
        return this.getSiteLabourReport(filters.siteId, userId, role, filters);
      case 'site-materials':
        return this.getSiteMaterialReport(filters.siteId, userId, role, filters);
      case 'site-expenses':
        return this.getSiteExpenseReport(filters.siteId, userId, role, filters);
      case 'site-progress':
        return this.getSiteProgressReport(filters.siteId, userId, role, filters);
      case 'attendance':
        return this.getAttendanceReport(userId, role, filters);
      case 'financial-costs':
        return this.getFinancialCostReport(userId, role, filters);
      case 'financial-profitability':
        return this.getFinancialProfitabilityReport(userId, role, filters);
      default:
        throw new BadRequestException(`Unsupported reportType: ${reportType}`);
    }
  }

  private formatExport(data: any, format: string, reportType: string): string {
    if (format === 'csv' || format === 'excel') {
      return this.convertToCsv(data);
    }
    if (format === 'pdf') {
      return this.convertToHtmlDocument(data, reportType);
    }
    return JSON.stringify(data, null, 2);
  }

  private convertToCsv(data: any): string {
    if (!data) return '';
    // If array of objects
    if (Array.isArray(data)) {
      if (data.length === 0) return 'No data available';
      const headers = Object.keys(data[0]);
      const rows = data.map((item) =>
        headers.map((h) => JSON.stringify(item[h] ?? '')).join(','),
      );
      return [headers.join(','), ...rows].join('\n');
    }
    // If object with items array
    if (Array.isArray(data.items)) {
      return this.convertToCsv(data.items);
    }
    // Key-value summary
    const flatten = (obj: any, prefix = ''): Array<[string, any]> => {
      let res: Array<[string, any]> = [];
      for (const [k, v] of Object.entries(obj)) {
        if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
          res = res.concat(flatten(v, `${prefix}${k}.`));
        } else {
          res.push([`${prefix}${k}`, v]);
        }
      }
      return res;
    };
    const pairs = flatten(data);
    return ['Metric,Value', ...pairs.map(([k, v]) => `"${k}","${v ?? ''}"`)].join('\n');
  }

  private convertToHtmlDocument(data: any, reportType: string): string {
    const csvContent = this.convertToCsv(data);
    const rows = csvContent.split('\n').map((line) => line.split(','));
    const headerRow = rows[0] ?? [];
    const bodyRows = rows.slice(1);

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${reportType.toUpperCase()} Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 40px; color: #333; }
    h1 { font-size: 20px; border-bottom: 2px solid #2563eb; padding-bottom: 8px; color: #1e3a8a; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
    th { background: #f1f5f9; text-align: left; padding: 10px; border: 1px solid #cbd5e1; font-weight: 600; }
    td { padding: 8px 10px; border: 1px solid #e2e8f0; }
    tr:nth-child(even) { background: #f8fafc; }
    .meta { font-size: 11px; color: #64748b; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 8px; }
  </style>
</head>
<body>
  <h1>INFYLE CONSTRUCTION PLATFORM — ${reportType.toUpperCase()} REPORT</h1>
  <table>
    <thead>
      <tr>${headerRow.map((h) => `<th>${h.replace(/"/g, '')}</th>`).join('')}</tr>
    </thead>
    <tbody>
      ${bodyRows.map((r) => `<tr>${r.map((c) => `<td>${c.replace(/"/g, '')}</td>`).join('')}</tr>`).join('')}
    </tbody>
  </table>
  <div class="meta">Generated: ${new Date().toISOString()} | Confidential</div>
</body>
</html>`;
  }

  private getMimeType(format: string): string {
    switch (format) {
      case 'csv':
        return 'text/csv';
      case 'excel':
        return 'application/vnd.ms-excel';
      case 'pdf':
        return 'application/pdf';
      default:
        return 'text/plain';
    }
  }

  private async getAccessibleProjects(userId: string, role: string, projectId?: string): Promise<Project[]> {
    if (projectId) {
      const p = await this.verifyProjectAccess(projectId, userId, role);
      return [p];
    }
    if (role === 'contractor') {
      const contractor = await this.contractorRepo.findOne({ where: { userId } });
      if (!contractor) return [];
      return this.projectRepo.find({ where: { contractorId: contractor.id } });
    }
    return this.projectRepo.find();
  }

  private async verifyProjectAccess(projectId: string, userId: string, role: string): Promise<Project> {
    const project = await this.projectRepo.findOne({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Project not found');

    if (role === 'contractor') {
      const contractor = await this.contractorRepo.findOne({ where: { userId } });
      if (!contractor || project.contractorId !== contractor.id) {
        throw new ForbiddenException('You do not have access to this project');
      }
    } else if (role !== 'admin') {
      throw new ForbiddenException('Access denied to this project');
    }
    return project;
  }

  private async verifySiteAccess(siteId: string, userId: string, role: string): Promise<void> {
    if (role === 'admin') return;

    if (role === 'site_engineer') {
      const assignment = await this.assignmentRepo.findOne({
        where: { siteId, userId, isActive: true },
      });
      if (!assignment) {
        throw new ForbiddenException('You are not assigned to this site');
      }
    } else if (role === 'contractor') {
      const contractor = await this.contractorRepo.findOne({ where: { userId } });
      if (!contractor) throw new ForbiddenException('Contractor profile not found');

      const project = await this.projectRepo
        .createQueryBuilder('p')
        .innerJoin('project_sites', 'ps', 'ps."projectId" = p.id')
        .where('ps.id = :siteId', { siteId })
        .andWhere('p."contractorId" = :contractorId', { contractorId: contractor.id })
        .getOne();

      if (!project) {
        throw new ForbiddenException('You do not have access to this site');
      }
    } else {
      throw new ForbiddenException('Access denied to this site');
    }
  }
}
