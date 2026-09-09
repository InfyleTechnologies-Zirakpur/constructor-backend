import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from '../reports.service.js';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DailyReport } from '../entities/daily-report.entity.js';
import { SiteEngineerAssignment } from '../../site-engineers/entities/site-engineer-assignment.entity.js';
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
  let assignmentRepo: any;
  let attendanceService: any;
  let materialsService: any;
  let expensesService: any;

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
            createQueryBuilder: vi.fn(() => ({
              where: vi.fn().mockReturnThis(),
              andWhere: vi.fn().mockReturnThis(),
              leftJoinAndSelect: vi.fn().mockReturnThis(),
              orderBy: vi.fn().mockReturnThis(),
              getMany: vi.fn().mockResolvedValue([]),
            })),
          },
        },
        {
          provide: getRepositoryToken(SiteEngineerAssignment),
          useValue: {
            findOne: vi.fn(),
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
    assignmentRepo = module.get(getRepositoryToken(SiteEngineerAssignment));
    attendanceService = module.get(AttendanceService);
    materialsService = module.get(MaterialsService);
    expensesService = module.get(ExpensesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createDailyReport', () => {
    it('should aggregate costs server-side and calculate profit', async () => {
      reportRepo.findOne.mockResolvedValue(null); // no duplicate

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
          estimatedProfit: 5500, // 15000 - 9500
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

    it('should handle zero revenue gracefully (negative profit)', async () => {
      reportRepo.findOne.mockResolvedValue(null);

      await service.createDailyReport('site-1', 'admin-1', 'admin', {
        date: '2026-09-09',
      });

      // Revenue=0, Cost=9000 (5000+3000+1000+0) → Profit = -9000
      expect(reportRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          totalDailyCost: 9000,
          dailyRevenue: 0,
          estimatedProfit: -9000,
        }),
      );
    });
  });

  describe('updateReportStatus', () => {
    it('should submit a draft report and re-aggregate costs', async () => {
      reportRepo.findOne.mockResolvedValue({
        id: 'rpt-1',
        siteId: 'site-1',
        date: '2026-09-09',
        status: 'draft',
        otherCosts: 200,
        dailyRevenue: 12000,
      });

      await service.updateReportStatus('rpt-1', 'eng-1', 'admin', {
        status: 'submitted',
      });

      expect(attendanceService.getSiteLabourCost).toHaveBeenCalled();
      expect(materialsService.getSiteMaterialCost).toHaveBeenCalled();
      expect(expensesService.getSiteExpenseCost).toHaveBeenCalled();
      expect(reportRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'submitted' }),
      );
    });

    it('should reject submitting a non-draft report', async () => {
      reportRepo.findOne.mockResolvedValue({
        id: 'rpt-1',
        status: 'submitted',
      });

      await expect(
        service.updateReportStatus('rpt-1', 'eng-1', 'admin', {
          status: 'submitted',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow only admin/contractor to review', async () => {
      reportRepo.findOne.mockResolvedValue({
        id: 'rpt-1',
        status: 'submitted',
      });

      await expect(
        service.updateReportStatus('rpt-1', 'eng-1', 'site_engineer', {
          status: 'reviewed',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException for missing report', async () => {
      reportRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateReportStatus('bad-id', 'admin-1', 'admin', {
          status: 'submitted',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getReportById', () => {
    it('should return a report', async () => {
      reportRepo.findOne.mockResolvedValue({ id: 'rpt-1' });
      const result = await service.getReportById('rpt-1');
      expect(result.id).toEqual('rpt-1');
    });

    it('should throw NotFoundException', async () => {
      reportRepo.findOne.mockResolvedValue(null);
      await expect(service.getReportById('bad')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
