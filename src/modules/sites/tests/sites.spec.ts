import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { SitesService } from '../sites.service.js';
import { SitesController } from '../sites.controller.js';
import { Attendance } from '../../attendance/entities/attendance.entity.js';
import { DailyReport } from '../../reports/entities/daily-report.entity.js';

describe('SitesModule', () => {
  let service: SitesService;
  let controller: SitesController;

  const mockAttendanceRepo = {
    create: vi.fn((dto) => ({ ...dto, id: 'att-1' })),
    save: vi.fn((entity) =>
      Promise.resolve({ ...entity, id: entity.id || 'att-1' }),
    ),
    findOne: vi.fn(),
  };

  const mockDailyReportRepo = {
    create: vi.fn((dto) => ({ ...dto, id: 'report-1' })),
    save: vi.fn((entity) =>
      Promise.resolve({ ...entity, id: entity.id || 'report-1' }),
    ),
    findOne: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SitesController],
      providers: [
        SitesService,
        {
          provide: getRepositoryToken(Attendance),
          useValue: mockAttendanceRepo,
        },
        {
          provide: getRepositoryToken(DailyReport),
          useValue: mockDailyReportRepo,
        },
      ],
    }).compile();

    service = module.get<SitesService>(SitesService);
    controller = module.get<SitesController>(SitesController);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(controller).toBeDefined();
  });

  describe('SitesService.checkIn', () => {
    it('should check in with a string userId', async () => {
      mockAttendanceRepo.findOne.mockResolvedValue(null);

      const result = await service.checkIn('site-123', 'user-456');

      expect(mockAttendanceRepo.findOne).toHaveBeenCalledWith({
        where: { userId: 'user-456', date: expect.any(String) },
      });
      expect(mockAttendanceRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          siteId: 'site-123',
          userId: 'user-456',
          status: 'present',
        }),
      );
      expect(result).toHaveProperty('userId', 'user-456');
    });

    it('should check in with an object containing userId and coordinates', async () => {
      mockAttendanceRepo.findOne.mockResolvedValue(null);

      const result = await service.checkIn('site-123', {
        userId: 'user-789',
        latitude: 30.21,
        longitude: 74.945,
      });

      expect(mockAttendanceRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          siteId: 'site-123',
          userId: 'user-789',
          checkInLatitude: 30.21,
          checkInLongitude: 74.945,
          status: 'present',
        }),
      );
      expect(result).toHaveProperty('userId', 'user-789');
    });

    it('should check in with workerId when userId is not provided', async () => {
      mockAttendanceRepo.findOne.mockResolvedValue(null);

      const result = await service.checkIn('site-123', {
        workerId: 'worker-999',
      });

      expect(mockAttendanceRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'worker-999',
        }),
      );
      expect(result).toHaveProperty('userId', 'worker-999');
    });

    it('should throw BadRequestException if userId is missing', async () => {
      await expect(service.checkIn('site-123', {} as any)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.checkIn('site-123', '' as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ConflictException if already checked in and not checked out', async () => {
      mockAttendanceRepo.findOne.mockResolvedValue({
        id: 'att-1',
        userId: 'user-1',
        checkInTime: new Date(),
        checkOutTime: null,
      });

      await expect(service.checkIn('site-123', 'user-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw ConflictException if already completed attendance today', async () => {
      mockAttendanceRepo.findOne.mockResolvedValue({
        id: 'att-1',
        userId: 'user-1',
        checkInTime: new Date(),
        checkOutTime: new Date(),
      });

      await expect(service.checkIn('site-123', 'user-1')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('SitesController.checkIn', () => {
    it('should extract userId from req.user when dto has no userId', async () => {
      mockAttendanceRepo.findOne.mockResolvedValue(null);

      const req = { user: { id: 'auth-user-1', role: 'site_engineer' } };
      const result = await controller.checkIn(req, 'site-123', {
        latitude: 30.21,
        longitude: 74.945,
      });

      expect(mockAttendanceRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          siteId: 'site-123',
          userId: 'auth-user-1',
          checkInLatitude: 30.21,
          checkInLongitude: 74.945,
        }),
      );
      expect(result).toHaveProperty('userId', 'auth-user-1');
    });

    it('should prioritize dto.userId when provided by contractor/engineer', async () => {
      mockAttendanceRepo.findOne.mockResolvedValue(null);

      const req = { user: { id: 'contractor-1', role: 'contractor' } };
      const result = await controller.checkIn(req, 'site-123', {
        userId: 'worker-id-100',
      });

      expect(mockAttendanceRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          siteId: 'site-123',
          userId: 'worker-id-100',
        }),
      );
      expect(result).toHaveProperty('userId', 'worker-id-100');
    });

    it('should fall back to req.user.sub if id is missing', async () => {
      mockAttendanceRepo.findOne.mockResolvedValue(null);

      const req = { user: { sub: 'sub-user-uuid', role: 'site_engineer' } };
      const result = await controller.checkIn(req, 'site-123', {});

      expect(mockAttendanceRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          siteId: 'site-123',
          userId: 'sub-user-uuid',
        }),
      );
      expect(result).toHaveProperty('userId', 'sub-user-uuid');
    });
  });

  describe('SitesService.createDailyReport', () => {
    it('should create a daily report with submittedById', async () => {
      const result = await service.createDailyReport('site-123', {
        submittedById: 'user-1',
        totalLabourCost: 500,
        totalMaterialCost: 300,
        totalExpense: 100,
        estimatedProfit: 1000,
      });

      expect(mockDailyReportRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          siteId: 'site-123',
          submittedById: 'user-1',
          totalLabourCost: 500,
          totalMaterialCost: 300,
          totalExpense: 100,
          estimatedProfit: 1000,
          status: 'draft',
        }),
      );
      expect(result).toHaveProperty('id', 'report-1');
    });
  });
});
