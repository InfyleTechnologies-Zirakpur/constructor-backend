import { Test, TestingModule } from '@nestjs/testing';
import { ExpensesService } from '../expenses.service.js';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Expense } from '../entities/expense.entity.js';
import { SiteEngineerAssignment } from '../../site-engineers/entities/site-engineer-assignment.entity.js';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('ExpensesService', () => {
  let service: ExpensesService;
  let expenseRepo: any;
  let assignmentRepo: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpensesService,
        {
          provide: getRepositoryToken(Expense),
          useValue: {
            create: vi.fn((data) => ({ id: 'exp-1', ...data })),
            save: vi.fn((data) => Promise.resolve(data)),
            findOne: vi.fn(),
            createQueryBuilder: vi.fn(() => ({
              where: vi.fn().mockReturnThis(),
              andWhere: vi.fn().mockReturnThis(),
              orderBy: vi.fn().mockReturnThis(),
              addOrderBy: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              getMany: vi.fn().mockResolvedValue([]),
              getRawOne: vi.fn().mockResolvedValue({ total: 100 }),
            })),
          },
        },
        {
          provide: getRepositoryToken(SiteEngineerAssignment),
          useValue: {
            findOne: vi.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ExpensesService>(ExpensesService);
    expenseRepo = module.get(getRepositoryToken(Expense));
    assignmentRepo = module.get(getRepositoryToken(SiteEngineerAssignment));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createExpense', () => {
    it('should create an expense without checking access for admin', async () => {
      const result = await service.createExpense('site-1', 'admin-1', 'admin', {
        date: '2026-09-09',
        amount: 500,
        category: 'Travel',
        description: 'Site visit',
      });

      expect(expenseRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          siteId: 'site-1',
          amount: 500,
          category: 'Travel',
        }),
      );
      expect(result.id).toEqual('exp-1');
    });

    it('should verify site access for site_engineer', async () => {
      assignmentRepo.findOne.mockResolvedValue({ id: 'ass-1' });

      await service.createExpense('site-1', 'eng-1', 'site_engineer', {
        date: '2026-09-09',
        amount: 100,
        category: 'Food',
      });

      expect(assignmentRepo.findOne).toHaveBeenCalledWith({
        where: { siteId: 'site-1', userId: 'eng-1', isActive: true },
      });
    });

    it('should throw ForbiddenException if site_engineer has no access', async () => {
      assignmentRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createExpense('site-1', 'eng-1', 'site_engineer', {
          date: '2026-09-09',
          amount: 100,
          category: 'Food',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getExpenseById', () => {
    it('should return the expense', async () => {
      expenseRepo.findOne.mockResolvedValue({ id: 'exp-1', amount: 500 });
      const result = await service.getExpenseById('exp-1');
      expect(result.amount).toEqual(500);
    });

    it('should throw NotFoundException if not found', async () => {
      expenseRepo.findOne.mockResolvedValue(null);
      await expect(service.getExpenseById('invalid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateExpense', () => {
    it('should update the expense', async () => {
      expenseRepo.findOne.mockResolvedValue({
        id: 'exp-1',
        siteId: 'site-1',
        amount: 500,
      });

      const result = await service.updateExpense(
        'exp-1',
        'admin-1',
        'admin',
        { amount: 600 },
      );

      expect(expenseRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 600 }),
      );
      expect(result.amount).toEqual(600);
    });
  });

  describe('getSiteExpenseCost', () => {
    it('should return the total expense from query builder', async () => {
      const result = await service.getSiteExpenseCost('site-1');
      expect(result).toEqual(100);
    });
  });
});
