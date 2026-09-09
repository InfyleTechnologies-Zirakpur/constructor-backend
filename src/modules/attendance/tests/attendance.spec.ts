import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AttendanceService } from '../attendance.service.js';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Attendance } from '../entities/attendance.entity.js';
import { LabourRecord } from '../entities/labour-record.entity.js';
import { SiteEngineerAssignment } from '../../site-engineers/entities/site-engineer-assignment.entity.js';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

describe('AttendanceService', () => {
  let service: AttendanceService;
  let attendanceRepo: any;
  let labourRepo: any;
  let assignmentRepo: any;

  const today = (() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  })();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        {
          provide: getRepositoryToken(Attendance),
          useValue: {
            findOne: vi.fn(),
            find: vi.fn(),
            create: vi.fn((data) => ({
              id: 'att-1',
              totalMinutes: 0,
              overtimeMinutes: 0,
              ...data,
            })),
            save: vi.fn((data) => Promise.resolve(data)),
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
          provide: getRepositoryToken(LabourRecord),
          useValue: {
            findOne: vi.fn(),
            find: vi.fn().mockResolvedValue([]),
            create: vi.fn((data) => ({ id: 'lab-1', ...data })),
            save: vi.fn((data) => Promise.resolve(data)),
          },
        },
        {
          provide: getRepositoryToken(SiteEngineerAssignment),
          useValue: {
            findOne: vi.fn(),
            find: vi.fn().mockResolvedValue([]),
          },
        },
      ],
    }).compile();

    service = module.get<AttendanceService>(AttendanceService);
    attendanceRepo = module.get(getRepositoryToken(Attendance));
    labourRepo = module.get(getRepositoryToken(LabourRecord));
    assignmentRepo = module.get(getRepositoryToken(SiteEngineerAssignment));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── Check-In ─────────────────────────────────────

  describe('checkIn', () => {
    it('should create a new attendance record', async () => {
      attendanceRepo.findOne.mockResolvedValue(null);

      const result = await service.checkIn('user-1', {
        latitude: 30.21,
        longitude: 74.945,
      });

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('checkIn');
      expect(result).toHaveProperty('status', 'present');
      expect(attendanceRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          date: today,
          checkInLatitude: 30.21,
          checkInLongitude: 74.945,
        }),
      );
    });

    it('should throw ConflictException if already checked in', async () => {
      attendanceRepo.findOne.mockResolvedValue({
        checkInTime: new Date(),
        checkOutTime: null,
      });

      await expect(
        service.checkIn('user-1', { latitude: 30.21, longitude: 74.945 }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException if already completed today', async () => {
      attendanceRepo.findOne.mockResolvedValue({
        checkInTime: new Date(),
        checkOutTime: new Date(),
      });

      await expect(
        service.checkIn('user-1', { latitude: 30.21, longitude: 74.945 }),
      ).rejects.toThrow(ConflictException);
    });

    it('should accept optional siteId', async () => {
      attendanceRepo.findOne.mockResolvedValue(null);

      await service.checkIn('user-1', {
        latitude: 30.21,
        longitude: 74.945,
        siteId: 'site-1',
      });

      expect(attendanceRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ siteId: 'site-1' }),
      );
    });
  });

  // ─── Check-Out ────────────────────────────────────

  describe('checkOut', () => {
    it('should update attendance with check-out and calculate hours', async () => {
      const checkInTime = new Date();
      checkInTime.setHours(checkInTime.getHours() - 9); // 9 hours ago

      attendanceRepo.findOne.mockResolvedValue({
        id: 'att-1',
        userId: 'user-1',
        date: today,
        checkInTime,
        checkOutTime: null,
        totalMinutes: 0,
        overtimeMinutes: 0,
        status: 'present',
      });

      const result = await service.checkOut('user-1', {
        latitude: 30.21,
        longitude: 74.945,
      });

      expect(result).toHaveProperty('checkOut');
      expect(result.checkOut).not.toBeNull();
      // 9 hours = 540 min, 540 - 480 = 60 min overtime
      expect(attendanceRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          checkOutLatitude: 30.21,
          checkOutLongitude: 74.945,
        }),
      );
    });

    it('should throw BadRequestException if no open check-in', async () => {
      attendanceRepo.findOne.mockResolvedValue(null);

      await expect(
        service.checkOut('user-1', { latitude: 30.21, longitude: 74.945 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if already checked out', async () => {
      attendanceRepo.findOne.mockResolvedValue({
        checkInTime: new Date(),
        checkOutTime: new Date(),
      });

      await expect(
        service.checkOut('user-1', { latitude: 30.21, longitude: 74.945 }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ─── getById ──────────────────────────────────────

  describe('getById', () => {
    it('should return attendance for admin', async () => {
      attendanceRepo.findOne.mockResolvedValue({
        id: 'att-1',
        date: today,
        checkInTime: new Date(),
        checkOutTime: null,
        totalMinutes: 0,
        overtimeMinutes: 0,
        status: 'present',
      });

      const result = await service.getById('att-1', 'admin-user', 'admin');
      expect(result).toHaveProperty('id', 'att-1');
    });

    it('should throw NotFoundException', async () => {
      attendanceRepo.findOne.mockResolvedValue(null);

      await expect(
        service.getById('nonexistent', 'user', 'admin'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException for wrong user', async () => {
      attendanceRepo.findOne.mockResolvedValue({
        id: 'att-1',
        userId: 'user-1',
        date: today,
        checkInTime: new Date(),
        checkOutTime: null,
        totalMinutes: 0,
        overtimeMinutes: 0,
        status: 'present',
      });

      await expect(
        service.getById('att-1', 'user-2', 'job_seeker'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── Labour Records ───────────────────────────────

  describe('createLabourRecord', () => {
    it('should create a record with server-calculated totalCost', async () => {
      await service.createLabourRecord('admin-1', 'admin', {
        siteId: 'site-1',
        date: today,
        headcount: 10,
        dailyWage: 500,
        overtimeHours: 2,
        overtimeRate: 100,
      });

      // totalCost = (10 × 500) + (2 × 100) = 5200
      expect(labourRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          totalCost: 5200,
        }),
      );
    });

    it('should verify site access for site_engineer', async () => {
      assignmentRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createLabourRecord('eng-1', 'site_engineer', {
          siteId: 'site-1',
          date: today,
          headcount: 5,
          dailyWage: 400,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should calculate cost without overtime when not provided', async () => {
      await service.createLabourRecord('admin-1', 'admin', {
        siteId: 'site-1',
        date: today,
        headcount: 5,
        dailyWage: 600,
      });

      // totalCost = 5 × 600 = 3000
      expect(labourRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          totalCost: 3000,
        }),
      );
    });
  });
});
