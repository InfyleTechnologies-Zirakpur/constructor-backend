import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PaymentsService } from '../payments.service.js';
import { Payment } from '../entities/payment.entity.js';
import { User } from '../../users/entities/user.entity.js';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let paymentRepo: any;
  let userRepo: any;

  const mockPayment = {
    id: 'pay-1',
    jobId: 'job-1',
    workerId: 'worker-1',
    contractorId: 'contractor-1',
    amount: 1500,
    currency: 'INR',
    status: 'pending',
    transactionId: 'TXN-123456',
    paymentMethod: 'bank_transfer',
    description: 'Weekly wage',
    paidAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPaymentRepo = {
    create: vi.fn(),
    save: vi.fn(),
    findOne: vi.fn(),
    find: vi.fn(),
    createQueryBuilder: vi.fn(),
  };

  const mockUserRepo = {
    findOne: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: getRepositoryToken(Payment),
          useValue: mockPaymentRepo,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepo,
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    paymentRepo = module.get(getRepositoryToken(Payment));
    userRepo = module.get(getRepositoryToken(User));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create and save a new payment record', async () => {
      paymentRepo.create.mockReturnValue(mockPayment);
      paymentRepo.save.mockResolvedValue(mockPayment);

      const result = await service.create('contractor-1', 'contractor', {
        amount: 1500,
        workerId: 'worker-1',
        jobId: 'job-1',
      });

      expect(paymentRepo.create).toHaveBeenCalled();
      expect(paymentRepo.save).toHaveBeenCalled();
      expect(result.id).toBe('pay-1');
      expect(result.amount).toBe(1500);
    });
  });

  describe('findOne', () => {
    it('should return payment for authorized admin', async () => {
      paymentRepo.findOne.mockResolvedValue(mockPayment);

      const result = await service.findOne('pay-1', 'admin-1', 'admin');
      expect(result).toEqual(mockPayment);
    });

    it('should throw ForbiddenException for unauthorized worker', async () => {
      paymentRepo.findOne.mockResolvedValue(mockPayment);

      await expect(
        service.findOne('pay-1', 'wrong-worker', 'job_seeker'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if payment not found', async () => {
      paymentRepo.findOne.mockResolvedValue(null);

      await expect(
        service.findOne('invalid-id', 'admin-1', 'admin'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus', () => {
    it('should update status and set paidAt when completed', async () => {
      paymentRepo.findOne.mockResolvedValue({ ...mockPayment });
      paymentRepo.save.mockImplementation(async (p: any) => p);

      const result = await service.updateStatus('pay-1', 'admin-1', 'admin', {
        status: 'completed',
        transactionId: 'TXN-CONFIRMED',
      });

      expect(result.status).toBe('completed');
      expect(result.paidAt).toBeInstanceOf(Date);
      expect(result.transactionId).toBe('TXN-CONFIRMED');
    });
  });

  describe('refund', () => {
    it('should refund a completed payment', async () => {
      paymentRepo.findOne.mockResolvedValue({
        ...mockPayment,
        status: 'completed',
      });
      paymentRepo.save.mockImplementation(async (p: any) => p);

      const result = await service.refund(
        'pay-1',
        'admin-1',
        'admin',
        'Job cancelled',
      );

      expect(result.status).toBe('refunded');
      expect(result.description).toContain('Job cancelled');
    });

    it('should throw BadRequestException if payment is not completed', async () => {
      paymentRepo.findOne.mockResolvedValue({
        ...mockPayment,
        status: 'pending',
      });

      await expect(
        service.refund('pay-1', 'admin-1', 'admin'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getEarningsReport', () => {
    it('should aggregate worker earnings accurately', async () => {
      paymentRepo.find.mockResolvedValue([
        { ...mockPayment, amount: 2000, status: 'completed' },
        { ...mockPayment, amount: 1000, status: 'completed' },
        { ...mockPayment, amount: 500, status: 'pending' },
      ]);

      const report = await service.getEarningsReport('worker-1');

      expect(report.totalEarned).toBe(3000);
      expect(report.pendingAmount).toBe(500);
      expect(report.totalDisbursements).toBe(2);
      expect(report.pendingDisbursements).toBe(1);
    });
  });
});
