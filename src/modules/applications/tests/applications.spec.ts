import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApplicationsService } from '../applications.service.js';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Application } from '../entities/application.entity.js';
import { Job } from '../../jobs/entities/job.entity.js';
import { Company } from '../../companies/entities/company.entity.js';
import { Repository } from 'typeorm';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

describe('ApplicationsService', () => {
  let service: ApplicationsService;
  let applicationRepo: Repository<Application>;
  let jobRepo: Repository<Job>;
  let companyRepo: Repository<Company>;

  const mockJob = {
    id: 'job-1',
    title: 'Site Electrician',
    status: 'published',
    companyId: 'company-1',
  } as Job;

  const mockApplication = {
    id: 'app-1',
    jobId: 'job-1',
    userId: 'user-seeker',
    status: 'pending',
    coverNote: 'I am interested',
    job: mockJob,
    user: {
      id: 'user-seeker',
      fullName: 'Ravi Kumar',
      email: 'ravi@test.com',
      phone: '9876543210',
      role: 'job_seeker',
      avatarUrl: null,
      passwordHash: 'hashed',
    },
  } as unknown as Application;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApplicationsService,
        {
          provide: getRepositoryToken(Application),
          useValue: {
            findOne: vi.fn(),
            find: vi.fn(),
            create: vi.fn(),
            save: vi.fn(),
            createQueryBuilder: vi.fn(),
          },
        },
        {
          provide: getRepositoryToken(Job),
          useValue: {
            findOne: vi.fn(),
          },
        },
        {
          provide: getRepositoryToken(Company),
          useValue: {
            findOne: vi.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ApplicationsService>(ApplicationsService);
    applicationRepo = module.get<Repository<Application>>(
      getRepositoryToken(Application),
    );
    jobRepo = module.get<Repository<Job>>(getRepositoryToken(Job));
    companyRepo = module.get<Repository<Company>>(getRepositoryToken(Company));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── Apply ─────────────────────────────────────────

  describe('apply', () => {
    it('should create an application for a published job', async () => {
      vi.spyOn(jobRepo, 'findOne').mockResolvedValue(mockJob);
      vi.spyOn(applicationRepo, 'findOne').mockResolvedValue(null);
      vi.spyOn(applicationRepo, 'create').mockReturnValue(mockApplication);
      vi.spyOn(applicationRepo, 'save').mockResolvedValue(mockApplication);

      const result = await service.apply('job-1', 'user-seeker', {
        coverNote: 'I am interested',
      });

      expect(result).toEqual(mockApplication);
      expect(applicationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: 'job-1',
          userId: 'user-seeker',
          status: 'pending',
          coverNote: 'I am interested',
        }),
      );
    });

    it('should throw NotFoundException if job does not exist', async () => {
      vi.spyOn(jobRepo, 'findOne').mockResolvedValue(null);

      await expect(
        service.apply('nonexistent', 'user-seeker', {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if job is not published', async () => {
      vi.spyOn(jobRepo, 'findOne').mockResolvedValue({
        ...mockJob,
        status: 'draft',
      } as Job);

      await expect(service.apply('job-1', 'user-seeker', {})).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ConflictException for duplicate application', async () => {
      vi.spyOn(jobRepo, 'findOne').mockResolvedValue(mockJob);
      vi.spyOn(applicationRepo, 'findOne').mockResolvedValue(mockApplication);

      await expect(service.apply('job-1', 'user-seeker', {})).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ─── getById ───────────────────────────────────────

  describe('getById', () => {
    it('should return application for admin', async () => {
      vi.spyOn(applicationRepo, 'findOne').mockResolvedValue(mockApplication);

      const result = await service.getById('app-1', 'admin', 'any-user');
      expect(result).toEqual(mockApplication);
    });

    it('should throw NotFoundException if application does not exist', async () => {
      vi.spyOn(applicationRepo, 'findOne').mockResolvedValue(null);

      await expect(
        service.getById('nonexistent', 'admin', 'any-user'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if job_seeker tries to view another user application', async () => {
      vi.spyOn(applicationRepo, 'findOne').mockResolvedValue(mockApplication);

      await expect(
        service.getById('app-1', 'job_seeker', 'different-user'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow job_seeker to view their own application', async () => {
      vi.spyOn(applicationRepo, 'findOne').mockResolvedValue(mockApplication);

      const result = await service.getById(
        'app-1',
        'job_seeker',
        'user-seeker',
      );
      expect(result).toEqual(mockApplication);
    });
  });

  // ─── updateStatus ──────────────────────────────────

  describe('updateStatus', () => {
    it('should update status for admin', async () => {
      const updated = { ...mockApplication, status: 'shortlisted' };
      vi.spyOn(applicationRepo, 'findOne').mockResolvedValue(mockApplication);
      vi.spyOn(applicationRepo, 'save').mockResolvedValue(
        updated as unknown as Application,
      );

      const result = await service.updateStatus('app-1', 'any-user', 'admin', {
        status: 'shortlisted',
      });
      expect(result.status).toBe('shortlisted');
    });

    it('should throw NotFoundException if application does not exist', async () => {
      vi.spyOn(applicationRepo, 'findOne').mockResolvedValue(null);

      await expect(
        service.updateStatus('nonexistent', 'user', 'admin', {
          status: 'shortlisted',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should enforce company ownership when company updates status', async () => {
      vi.spyOn(applicationRepo, 'findOne').mockResolvedValue(mockApplication);
      vi.spyOn(jobRepo, 'findOne').mockResolvedValue(mockJob);
      vi.spyOn(companyRepo, 'findOne').mockResolvedValue(null);

      await expect(
        service.updateStatus('app-1', 'wrong-user', 'company', {
          status: 'shortlisted',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ─── withdraw ──────────────────────────────────────

  describe('withdraw', () => {
    it('should allow job seeker to withdraw their own pending application', async () => {
      const withdrawn = { ...mockApplication, status: 'withdrawn' };
      vi.spyOn(applicationRepo, 'findOne').mockResolvedValue(mockApplication);
      vi.spyOn(applicationRepo, 'save').mockResolvedValue(
        withdrawn as unknown as Application,
      );

      const result = await service.withdraw('app-1', 'user-seeker');
      expect(result.status).toBe('withdrawn');
    });

    it('should throw ForbiddenException if trying to withdraw another user application', async () => {
      vi.spyOn(applicationRepo, 'findOne').mockResolvedValue(mockApplication);

      await expect(service.withdraw('app-1', 'different-user')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException if application is already accepted', async () => {
      vi.spyOn(applicationRepo, 'findOne').mockResolvedValue({
        ...mockApplication,
        status: 'accepted',
      } as unknown as Application);

      await expect(service.withdraw('app-1', 'user-seeker')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException if application does not exist', async () => {
      vi.spyOn(applicationRepo, 'findOne').mockResolvedValue(null);

      await expect(
        service.withdraw('nonexistent', 'user-seeker'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
