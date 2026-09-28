import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from '../reports.service.js';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DailyReport } from '../entities/daily-report.entity.js';
import { ReportExport } from '../entities/report-export.entity.js';
import { SiteEngineerAssignment } from '../../site-engineers/entities/site-engineer-assignment.entity.js';
import { Project } from '../../projects/entities/project.entity.js';
import { ProjectSite } from '../../project-sites/entities/project-site.entity.js';
import { Contractor } from '../../contractors/entities/contractor.entity.js';
import { Attendance } from '../../attendance/entities/attendance.entity.js';
import { LabourRecord } from '../../attendance/entities/labour-record.entity.js';
import { Material } from '../../materials/entities/material.entity.js';
import { MaterialTransaction } from '../../materials/entities/material-transaction.entity.js';
import { Expense } from '../../expenses/entities/expense.entity.js';
import { User } from '../../users/entities/user.entity.js';
import { Company } from '../../companies/entities/company.entity.js';
import { Job } from '../../jobs/entities/job.entity.js';
import { Application } from '../../applications/entities/application.entity.js';
import { AttendanceService } from '../../attendance/attendance.service.js';
import { MaterialsService } from '../../materials/materials.service.js';
import { ExpensesService } from '../../expenses/expenses.service.js';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('ReportsService', () => {
  let service: ReportsService;
  let reportRepo: any;
  let exportRepo: any;
  let assignmentRepo: any;
  let projectRepo: any;
  let siteRepo: any;
  let contractorRepo: any;
  let labourRepo: any;
  let materialTxnRepo: any;
  let expenseRepo: any;
  let userRepo: any;
  let companyRepo: any;
  let jobRepo: any;
  let applicationRepo: any;
  let attendanceService: any;
  let materialsService: any;
  let expensesService: any;

  const mockProject = {
    id: 'proj-1',
    name: 'Skyline Towers',
    location: 'Mohali',
    status: 'active',
    budget: 5000000,
    contractValue: 6000000,
    durationDays: 365,
    contractorId: 'c-1',
  };

  const mockSite = {
    id: 'site-1',
    name: 'Tower A',
    location: 'Mohali Sector 82',
    status: 'active',
    projectId: 'proj-1',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        {
          provide: getRepositoryToken(DailyReport),
          useValue: {
            create: vi.fn((data) => ({ id: 'rpt-1', ...data })),
            save: vi.fn((data) => Promise.resolve(data)),
            findOne: vi.fn(),
            find: vi.fn().mockResolvedValue([]),
            createQueryBuilder: vi.fn(() => ({
              where: vi.fn().mockReturnThis(),
              andWhere: vi.fn().mockReturnThis(),
              leftJoinAndSelect: vi.fn().mockReturnThis(),
              orderBy: vi.fn().mockReturnThis(),
              skip: vi.fn().mockReturnThis(),
              take: vi.fn().mockReturnThis(),
              getMany: vi.fn().mockResolvedValue([]),
              getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
            })),
          },
        },
        {
          provide: getRepositoryToken(ReportExport),
          useValue: {
            save: vi.fn((data) => Promise.resolve(data)),
            find: vi.fn().mockResolvedValue([]),
            findOne: vi.fn(),
          },
        },
        {
          provide: getRepositoryToken(SiteEngineerAssignment),
          useValue: {
            findOne: vi.fn().mockResolvedValue({ id: 'ass-1', isActive: true }),
          },
        },
        {
          provide: getRepositoryToken(Project),
          useValue: {
            findOne: vi.fn().mockResolvedValue(mockProject),
            find: vi.fn().mockResolvedValue([mockProject]),
            createQueryBuilder: vi.fn(() => ({
              innerJoin: vi.fn().mockReturnThis(),
              where: vi.fn().mockReturnThis(),
              andWhere: vi.fn().mockReturnThis(),
              getOne: vi.fn().mockResolvedValue(mockProject),
            })),
          },
        },
        {
          provide: getRepositoryToken(ProjectSite),
          useValue: {
            find: vi.fn().mockResolvedValue([mockSite]),
            findOne: vi.fn().mockResolvedValue(mockSite),
          },
        },
        {
          provide: getRepositoryToken(Contractor),
          useValue: {
            findOne: vi.fn().mockResolvedValue({ id: 'c-1', userId: 'user-c' }),
            find: vi.fn().mockResolvedValue([{ id: 'c-1', userId: 'user-c', companyName: 'BuildCorp' }]),
            createQueryBuilder: vi.fn(() => ({
              leftJoinAndSelect: vi.fn().mockReturnThis(),
              where: vi.fn().mockReturnThis(),
              getMany: vi.fn().mockResolvedValue([{ id: 'c-1', companyName: 'BuildCorp', verificationStatus: 'verified' }]),
            })),
          },
        },
        {
          provide: getRepositoryToken(Attendance),
          useValue: {
            find: vi.fn().mockResolvedValue([]),
            createQueryBuilder: vi.fn(() => ({
              where: vi.fn().mockReturnThis(),
              andWhere: vi.fn().mockReturnThis(),
              orderBy: vi.fn().mockReturnThis(),
              take: vi.fn().mockReturnThis(),
              getMany: vi.fn().mockResolvedValue([
                { id: 'att-1', totalMinutes: 480, overtimeMinutes: 60, date: '2026-09-09' },
              ]),
            })),
          },
        },
        {
          provide: getRepositoryToken(LabourRecord),
          useValue: {
            find: vi.fn().mockResolvedValue([]),
            createQueryBuilder: vi.fn(() => ({
              select: vi.fn().mockReturnThis(),
              where: vi.fn().mockReturnThis(),
              andWhere: vi.fn().mockReturnThis(),
              orderBy: vi.fn().mockReturnThis(),
              getRawOne: vi.fn().mockResolvedValue({ total: 50000 }),
              getMany: vi.fn().mockResolvedValue([
                { id: 'lr-1', headcount: 10, category: 'Mason', totalCost: 8000, overtimeHours: 2, date: '2026-09-09' },
              ]),
            })),
          },
        },
        {
          provide: getRepositoryToken(Material),
          useValue: {
            find: vi.fn().mockResolvedValue([]),
          },
        },
        {
          provide: getRepositoryToken(MaterialTransaction),
          useValue: {
            find: vi.fn().mockResolvedValue([]),
            createQueryBuilder: vi.fn(() => ({
              select: vi.fn().mockReturnThis(),
              where: vi.fn().mockReturnThis(),
              andWhere: vi.fn().mockReturnThis(),
              leftJoinAndSelect: vi.fn().mockReturnThis(),
              orderBy: vi.fn().mockReturnThis(),
              getRawOne: vi.fn().mockResolvedValue({ total: 75000 }),
              getMany: vi.fn().mockResolvedValue([
                { id: 'mt-1', type: 'purchase', totalCost: 35000, supplier: 'Ambuja', date: '2026-09-09', material: { category: 'cement' } },
              ]),
            })),
          },
        },
        {
          provide: getRepositoryToken(Expense),
          useValue: {
            find: vi.fn().mockResolvedValue([]),
            createQueryBuilder: vi.fn(() => ({
              select: vi.fn().mockReturnThis(),
              where: vi.fn().mockReturnThis(),
              andWhere: vi.fn().mockReturnThis(),
              orderBy: vi.fn().mockReturnThis(),
              getRawOne: vi.fn().mockResolvedValue({ total: 12000 }),
              getMany: vi.fn().mockResolvedValue([
                { id: 'exp-1', amount: 5000, category: 'Travel', date: '2026-09-09' },
              ]),
            })),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            find: vi.fn().mockResolvedValue([
              { id: 'u-1', role: 'admin', isActive: true, isBlocked: false },
              { id: 'u-2', role: 'contractor', isActive: true, isBlocked: false },
            ]),
          },
        },
        {
          provide: getRepositoryToken(Company),
          useValue: {
            find: vi.fn().mockResolvedValue([
              { id: 'comp-1', name: 'Acme Infra', verificationStatus: 'verified', userId: 'user-comp' },
            ]),
            findOne: vi.fn().mockResolvedValue({ id: 'comp-1', name: 'Acme Infra', userId: 'user-comp' }),
          },
        },
        {
          provide: getRepositoryToken(Job),
          useValue: {
            find: vi.fn().mockResolvedValue([{ id: 'job-1', title: 'Mason', status: 'published' }]),
            createQueryBuilder: vi.fn(() => ({
              where: vi.fn().mockReturnThis(),
              getMany: vi.fn().mockResolvedValue([{ id: 'job-1', title: 'Mason', status: 'published' }]),
            })),
          },
        },
        {
          provide: getRepositoryToken(Application),
          useValue: {
            find: vi.fn().mockResolvedValue([{ id: 'app-1', status: 'pending', jobId: 'job-1' }]),
          },
        },
        {
          provide: AttendanceService,
          useValue: {
            getSiteLabourCost: vi.fn().mockResolvedValue(5000),
          },
        },
        {
          provide: MaterialsService,
          useValue: {
            getSiteMaterialCost: vi.fn().mockResolvedValue(3000),
            getStock: vi.fn().mockResolvedValue([{ material: 'Cement', currentStock: 50 }]),
            listTransactions: vi.fn().mockResolvedValue({ items: [], total: 0 }),
          },
        },
        {
          provide: ExpensesService,
          useValue: {
            getSiteExpenseCost: vi.fn().mockResolvedValue(1000),
          },
        },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
    reportRepo = module.get(getRepositoryToken(DailyReport));
    exportRepo = module.get(getRepositoryToken(ReportExport));
    assignmentRepo = module.get(getRepositoryToken(SiteEngineerAssignment));
    projectRepo = module.get(getRepositoryToken(Project));
    siteRepo = module.get(getRepositoryToken(ProjectSite));
    contractorRepo = module.get(getRepositoryToken(Contractor));
    labourRepo = module.get(getRepositoryToken(LabourRecord));
    materialTxnRepo = module.get(getRepositoryToken(MaterialTransaction));
    expenseRepo = module.get(getRepositoryToken(Expense));
    userRepo = module.get(getRepositoryToken(User));
    companyRepo = module.get(getRepositoryToken(Company));
    jobRepo = module.get(getRepositoryToken(Job));
    applicationRepo = module.get(getRepositoryToken(Application));
    attendanceService = module.get(AttendanceService);
    materialsService = module.get(MaterialsService);
    expensesService = module.get(ExpensesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── 1. Daily Report Lifecycle ──────────────────

  describe('createDailyReport', () => {
    it('should aggregate costs server-side and calculate profit', async () => {
      reportRepo.findOne.mockResolvedValue(null);

      await service.createDailyReport('site-1', 'admin-1', 'admin', {
        date: '2026-09-09',
        otherCosts: 500,
        dailyRevenue: 15000,
        progressPercentage: 40,
        workCompleted: 'Foundation work',
      });

      // Labour=5000 + Material=3000 + Expense=1000 + Other=500 = 9500
      expect(reportRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          totalLabourCost: 5000,
          totalMaterialCost: 3000,
          totalExpense: 1000,
          otherCosts: 500,
          totalDailyCost: 9500,
          dailyRevenue: 15000,
          estimatedProfit: 5500,
          status: 'draft',
        }),
      );
    });

    it('should prevent duplicate reports for same site+date', async () => {
      reportRepo.findOne.mockResolvedValue({ id: 'existing' });

      await expect(
        service.createDailyReport('site-1', 'admin-1', 'admin', {
          date: '2026-09-09',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should verify site access for site_engineer', async () => {
      reportRepo.findOne.mockResolvedValue(null);
      assignmentRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createDailyReport('site-1', 'eng-1', 'site_engineer', {
          date: '2026-09-09',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateReportStatus', () => {
    it('should update status from draft to submitted and re-aggregate', async () => {
      reportRepo.findOne.mockResolvedValue({
        id: 'rpt-1',
        siteId: 'site-1',
        date: '2026-09-09',
        status: 'draft',
        otherCosts: 0,
        dailyRevenue: 10000,
      });

      await service.updateReportStatus('rpt-1', 'eng-1', 'site_engineer', {
        status: 'submitted',
      });

      expect(reportRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'submitted',
          totalDailyCost: 9000,
        }),
      );
    });

    it('should allow admin or contractor to review a submitted report', async () => {
      reportRepo.findOne.mockResolvedValue({
        id: 'rpt-1',
        status: 'submitted',
      });

      await service.updateReportStatus('rpt-1', 'admin-1', 'admin', {
        status: 'reviewed',
        remarks: 'Approved by PM',
      });

      expect(reportRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'reviewed',
          remarks: 'Approved by PM',
        }),
      );
    });
  });

  // ─── 2. Project Reports ─────────────────────────

  describe('Project Reports', () => {
    it('should return project summary with aggregated metrics', async () => {
      const summary = await service.getProjectSummary('proj-1', 'admin-1', 'admin');
      expect(summary.project.name).toBe('Skyline Towers');
      expect(summary.costs.labourCost).toBe(50000);
      expect(summary.costs.materialCost).toBe(75000);
      expect(summary.costs.expenseCost).toBe(12000);
      expect(summary.profitability.totalRevenue).toBe(6000000);
    });

    it('should return project progress overview and site breakdown', async () => {
      const progress = await service.getProjectProgress('proj-1', 'admin-1', 'admin');
      expect(progress.projectId).toBe('proj-1');
      expect(progress.sites).toHaveLength(1);
      expect(progress.sites[0].siteName).toBe('Tower A');
    });

    it('should return project cost breakdown vs budget', async () => {
      const cost = await service.getProjectCost('proj-1', 'admin-1', 'admin', {});
      expect(cost.budget).toBe(5000000);
      expect(cost.totalSpent).toBe(137000); // 50k + 75k + 12k
      expect(cost.remainingBudget).toBe(5000000 - 137000);
    });

    it('should return project labour cost breakdown by trades', async () => {
      const labour = await service.getProjectLabourCost('proj-1', 'admin-1', 'admin', {});
      expect(labour.trades).toHaveLength(1);
      expect(labour.trades[0].trade).toBe('Mason');
      expect(labour.totalWorkers).toBe(10);
    });

    it('should return project material cost breakdown by categories', async () => {
      const mat = await service.getProjectMaterialCost('proj-1', 'admin-1', 'admin', {});
      expect(mat.totalPurchases).toBe(35000);
      expect(mat.categories).toHaveLength(1);
      expect(mat.topSuppliers[0].supplier).toBe('Ambuja');
    });

    it('should return project expenses summary', async () => {
      const exp = await service.getProjectExpenses('proj-1', 'admin-1', 'admin', {});
      expect(exp.totalExpenses).toBe(5000);
      expect(exp.categories[0].category).toBe('Travel');
    });

    it('should return project profitability calculations', async () => {
      const prof = await service.getProjectProfitability('proj-1', 'admin-1', 'admin');
      expect(prof.financials.budget).toBe(5000000);
      expect(prof.profitability.status).toBe('profitable');
    });
  });

  // ─── 3. Site Reports ────────────────────────────

  describe('Site Reports', () => {
    it('should return site labour report', async () => {
      const labour = await service.getSiteLabourReport('site-1', 'admin-1', 'admin', {});
      expect(labour.siteId).toBe('site-1');
      expect(labour.totalWorkers).toBe(10);
      expect(labour.records).toHaveLength(1);
    });

    it('should return site material stock and transactions', async () => {
      const mat = await service.getSiteMaterialReport('site-1', 'admin-1', 'admin', {});
      expect(mat.siteId).toBe('site-1');
      expect(mat.currentStock).toHaveLength(1);
    });

    it('should return site expenses report', async () => {
      const exp = await service.getSiteExpenseReport('site-1', 'admin-1', 'admin', {});
      expect(exp.siteId).toBe('site-1');
      expect(exp.totalAmount).toBe(5000);
    });
  });

  // ─── 4. Operational & Financial Reports ─────────

  describe('Operational & Financial Reports', () => {
    it('should return operational attendance report', async () => {
      const att = await service.getAttendanceReport('admin-1', 'admin', {});
      expect(att.totalCheckIns).toBe(1);
      expect(att.totalHoursWorked).toBe(8);
      expect(att.totalOvertimeHours).toBe(1);
    });

    it('should return operational contractor portfolio metrics', async () => {
      const res = await service.getContractorReport('admin-1', 'admin', {});
      expect(res.items).toHaveLength(1);
      expect(res.items[0].companyName).toBe('BuildCorp');
    });

    it('should return operational user distribution for admin', async () => {
      const users = await service.getUserReport('admin-1', 'admin', {});
      expect(users.totalUsers).toBe(2);
      expect(users.roleDistribution.admin).toBe(1);
      expect(users.roleDistribution.contractor).toBe(1);
    });

    it('should return financial cost cross-project report', async () => {
      const costs = await service.getFinancialCostReport('admin-1', 'admin', {});
      expect(costs.totalBudget).toBe(5000000);
      expect(costs.totalSpent).toBe(137000);
    });

    it('should return financial profitability cross-project report', async () => {
      const prof = await service.getFinancialProfitabilityReport('admin-1', 'admin', {});
      expect(prof.portfolioFinancials.totalRevenue).toBe(6000000);
      expect(prof.projectRankings).toHaveLength(1);
    });
  });

  // ─── 5. Export Functionality ────────────────────

  describe('Export Functionality', () => {
    it('should create an export job and complete with CSV data', async () => {
      const exportJob = await service.createExport('admin-1', 'admin', {
        reportType: 'project-summary',
        format: 'csv' as any,
        filters: { projectId: 'proj-1' },
      });

      expect(exportJob.status).toBe('completed');
      expect(exportJob.fileName).toContain('.csv');
      expect(exportJob.fileUrl).toContain('/reports/export/');
    });

    it('should create an export job with HTML/PDF format', async () => {
      const exportJob = await service.createExport('admin-1', 'admin', {
        reportType: 'project-summary',
        format: 'pdf' as any,
        filters: { projectId: 'proj-1' },
      });

      expect(exportJob.status).toBe('completed');
      expect(exportJob.fileName).toContain('.pdf');
    });

    it('should provide direct streaming export file content', async () => {
      const file = await service.exportReportDirect(
        'project-cost',
        'csv',
        { projectId: 'proj-1' },
        'admin-1',
        'admin',
      );

      expect(file.mimeType).toBe('text/csv');
      expect(file.fileName).toContain('.csv');
      expect(file.content).toContain('Metric,Value');
    });
  });
});
