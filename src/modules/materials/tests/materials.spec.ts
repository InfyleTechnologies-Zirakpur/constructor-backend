import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MaterialsService } from '../materials.service.js';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Material } from '../entities/material.entity.js';
import { MaterialTransaction } from '../entities/material-transaction.entity.js';
import { SiteEngineerAssignment } from '../../site-engineers/entities/site-engineer-assignment.entity.js';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('MaterialsService', () => {
  let service: MaterialsService;
  let materialRepo: any;
  let transactionRepo: any;
  let assignmentRepo: any;

  const mockMaterial = {
    id: 'mat-1',
    name: 'Cement',
    unit: 'bag',
    category: 'cement',
    defaultRate: 350,
    isActive: true,
  } as Material;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaterialsService,
        {
          provide: getRepositoryToken(Material),
          useValue: {
            findOne: vi.fn(),
            create: vi.fn((data) => ({ id: 'mat-1', ...data })),
            save: vi.fn((data) => Promise.resolve(data)),
            createQueryBuilder: vi.fn(() => ({
              where: vi.fn().mockReturnThis(),
              andWhere: vi.fn().mockReturnThis(),
              orderBy: vi.fn().mockReturnThis(),
              skip: vi.fn().mockReturnThis(),
              take: vi.fn().mockReturnThis(),
              getManyAndCount: vi.fn().mockResolvedValue([[mockMaterial], 1]),
            })),
          },
        },
        {
          provide: getRepositoryToken(MaterialTransaction),
          useValue: {
            findOne: vi.fn(),
            create: vi.fn((data) => ({ id: 'txn-1', ...data })),
            save: vi.fn((data) => Promise.resolve(data)),
            createQueryBuilder: vi.fn(() => ({
              where: vi.fn().mockReturnThis(),
              andWhere: vi.fn().mockReturnThis(),
              leftJoinAndSelect: vi.fn().mockReturnThis(),
              orderBy: vi.fn().mockReturnThis(),
              addOrderBy: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              getMany: vi.fn().mockResolvedValue([]),
              getRawOne: vi.fn().mockResolvedValue({ total: 0 }),
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

    service = module.get<MaterialsService>(MaterialsService);
    materialRepo = module.get(getRepositoryToken(Material));
    transactionRepo = module.get(getRepositoryToken(MaterialTransaction));
    assignmentRepo = module.get(getRepositoryToken(SiteEngineerAssignment));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── Material Master ──────────────────────────────

  describe('createMaterial', () => {
    it('should create a material master record', async () => {
      const result = await service.createMaterial({
        name: 'Cement',
        unit: 'bag',
        category: 'cement',
        defaultRate: 350,
      });

      expect(materialRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Cement',
          unit: 'bag',
          category: 'cement',
          defaultRate: 350,
        }),
      );
      expect(result).toHaveProperty('id');
    });
  });

  describe('getMaterialById', () => {
    it('should return material if found', async () => {
      materialRepo.findOne.mockResolvedValue(mockMaterial);
      const result = await service.getMaterialById('mat-1');
      expect(result).toEqual(mockMaterial);
    });

    it('should throw NotFoundException if not found', async () => {
      materialRepo.findOne.mockResolvedValue(null);
      await expect(service.getMaterialById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateMaterial', () => {
    it('should update a material', async () => {
      materialRepo.findOne.mockResolvedValue({ ...mockMaterial });
      await service.updateMaterial('mat-1', {
        defaultRate: 400,
      });
      expect(materialRepo.save).toHaveBeenCalled();
    });
  });

  // ─── Material Transactions ────────────────────────

  describe('createTransaction', () => {
    it('should create a purchase transaction with server-calculated totalCost', async () => {
      materialRepo.findOne.mockResolvedValue(mockMaterial);

      await service.createTransaction('site-1', 'admin-1', 'admin', {
        materialId: 'mat-1',
        type: 'purchase',
        date: '2026-09-09',
        quantity: 100,
        rate: 350,
        supplier: 'ABC Suppliers',
      });

      // totalCost = 100 × 350 = 35000
      expect(transactionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          siteId: 'site-1',
          materialId: 'mat-1',
          type: 'purchase',
          quantity: 100,
          rate: 350,
          totalCost: 35000,
          supplier: 'ABC Suppliers',
        }),
      );
    });

    it('should set requestStatus to pending for request type', async () => {
      materialRepo.findOne.mockResolvedValue(mockMaterial);

      await service.createTransaction('site-1', 'eng-1', 'admin', {
        materialId: 'mat-1',
        type: 'request',
        date: '2026-09-09',
        quantity: 50,
        rate: 350,
      });

      expect(transactionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'request',
          requestStatus: 'pending',
        }),
      );
    });

    it('should throw NotFoundException if material does not exist', async () => {
      materialRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createTransaction('site-1', 'admin-1', 'admin', {
          materialId: 'nonexistent',
          type: 'purchase',
          date: '2026-09-09',
          quantity: 10,
          rate: 100,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should verify site access for site_engineer', async () => {
      assignmentRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createTransaction('site-1', 'eng-1', 'site_engineer', {
          materialId: 'mat-1',
          type: 'consumption',
          date: '2026-09-09',
          quantity: 5,
          rate: 350,
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── Request Status ───────────────────────────────

  describe('updateRequestStatus', () => {
    it('should update request status', async () => {
      transactionRepo.findOne.mockResolvedValue({
        id: 'txn-1',
        type: 'request',
        requestStatus: 'pending',
      });

      await service.updateRequestStatus('txn-1', {
        requestStatus: 'approved',
      });

      expect(transactionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ requestStatus: 'approved' }),
      );
    });

    it('should throw NotFoundException for missing transaction', async () => {
      transactionRepo.findOne.mockResolvedValue(null);
      await expect(
        service.updateRequestStatus('nonexistent', {
          requestStatus: 'approved',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for non-request transactions', async () => {
      transactionRepo.findOne.mockResolvedValue({
        id: 'txn-1',
        type: 'purchase',
      });

      await expect(
        service.updateRequestStatus('txn-1', {
          requestStatus: 'approved',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
