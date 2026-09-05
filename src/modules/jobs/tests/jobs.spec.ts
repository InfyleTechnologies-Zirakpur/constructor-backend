import { Test, TestingModule } from '@nestjs/testing';
import { JobsService } from '../jobs.service.js';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Job } from '../entities/job.entity.js';
import { Company } from '../../companies/entities/company.entity.js';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Repository } from 'typeorm';

const mockCompany = {
  id: 'company-1',
  userId: 'user-1',
};

const mockJob = {
  id: 'job-1',
  title: 'Test Job',
  companyId: 'company-1',
  status: 'published',
};

describe('JobsService', () => {
  let service: JobsService;
  let jobRepo: Repository<Job>;
  let companyRepo: Repository<Company>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobsService,
        {
          provide: getRepositoryToken(Job),
          useValue: {
            create: vi.fn().mockReturnValue(mockJob),
            save: vi.fn().mockResolvedValue(mockJob),
            findOne: vi.fn().mockResolvedValue(mockJob),
            createQueryBuilder: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnThis(),
              orderBy: vi.fn().mockReturnThis(),
              skip: vi.fn().mockReturnThis(),
              take: vi.fn().mockReturnThis(),
              getManyAndCount: vi.fn().mockResolvedValue([[mockJob], 1]),
            }),
          },
        },
        {
          provide: getRepositoryToken(Company),
          useValue: {
            findOne: vi.fn().mockResolvedValue(mockCompany),
          },
        },
      ],
    }).compile();

    service = module.get<JobsService>(JobsService);
    jobRepo = module.get<Repository<Job>>(getRepositoryToken(Job));
    companyRepo = module.get<Repository<Company>>(getRepositoryToken(Company));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should throw NotFoundException if company profile is missing', async () => {
      vi.spyOn(companyRepo, 'findOne').mockResolvedValueOnce(null);
      await expect(
        service.create('user-1', {
          title: 'Test',
          location: 'City',
          description: 'Desc',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create a job', async () => {
      const result = await service.create('user-1', {
        title: 'Test',
        location: 'City',
        description: 'Desc',
      });
      expect(result.id).toBe('job-1');
    });
  });

  describe('list', () => {
    it('should list all jobs for admin', async () => {
      const result = await service.list(1, 10, 'admin', 'admin-user');
      expect(result.total).toBe(1);
    });

    it('should list only company jobs for company', async () => {
      const result = await service.list(1, 10, 'company', 'user-1');
      expect(result.data).toHaveLength(1);
    });

    it('should list published jobs for job_seeker', async () => {
      const result = await service.list(1, 10, 'job_seeker', 'seeker-1');
      expect(result.data).toHaveLength(1);
    });
  });

  describe('getById', () => {
    it('should allow job seeker to see a published job', async () => {
      const result = await service.getById('job-1', 'job_seeker', 'seeker-1');
      expect(result.id).toBe('job-1');
    });

    it('should forbid job seeker from seeing a draft job', async () => {
      vi.spyOn(jobRepo, 'findOne').mockResolvedValueOnce({
        ...mockJob,
        status: 'draft',
      } as Job);
      await expect(
        service.getById('job-1', 'job_seeker', 'seeker-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should forbid company from viewing another company job', async () => {
      vi.spyOn(companyRepo, 'findOne').mockResolvedValueOnce({
        id: 'company-2',
        userId: 'user-2',
      } as Company);
      await expect(
        service.getById('job-1', 'company', 'user-2'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('close', () => {
    it('should close a job and return it', async () => {
      const saveSpy = vi
        .spyOn(jobRepo, 'save')
        .mockResolvedValueOnce({ ...mockJob, status: 'closed' } as Job);
      const result = await service.close('job-1', 'user-1');
      expect(result.status).toBe('closed');
      expect(saveSpy).toHaveBeenCalled();
    });
  });

  describe('moderate', () => {
    it('should moderate a job successfully', async () => {
      const saveSpy = vi
        .spyOn(jobRepo, 'save')
        .mockResolvedValueOnce({ ...mockJob, status: 'rejected' } as Job);
      const result = await service.moderate('job-1', {
        status: 'rejected',
        moderationRemarks: 'Violates policy',
      });
      expect(result.status).toBe('rejected');
      expect(saveSpy).toHaveBeenCalled();
    });
  });
});
