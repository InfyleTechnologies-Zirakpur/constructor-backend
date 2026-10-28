import { Test, TestingModule } from '@nestjs/testing';
import { JobsService } from '../jobs.service.js';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Job } from '../entities/job.entity.js';
import { SavedJob } from '../entities/saved-job.entity.js';
import { Application } from '../../applications/entities/application.entity.js';
import { Company } from '../../companies/entities/company.entity.js';
import { User } from '../../users/entities/user.entity.js';
import { NotificationsService } from '../../notifications/notifications.service.js';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Repository } from 'typeorm';

const mockCompany = {
  id: 'company-1',
  userId: 'user-1',
  name: 'Test Company',
};

const mockJob = {
  id: 'job-1',
  title: 'Test Job',
  location: 'City',
  companyId: 'company-1',
  status: 'published',
  dailyPay: 850,
  projectType: 'Full-time',
  experienceLevel: 'Any',
  skills: ['Electrical'],
  description: 'Test description',
  requirements: ['Requirement 1'],
  company: mockCompany,
};

const mockSeeker = {
  id: 'seeker-1',
  role: 'job_seeker',
  isActive: true,
  isBlocked: false,
};

describe('JobsService', () => {
  let service: JobsService;
  let jobRepo: Repository<Job>;
  let companyRepo: Repository<Company>;
  let userRepo: Repository<User>;

  const mockNotificationsService = {
    notifyNewJobPosted: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobsService,
        {
          provide: getRepositoryToken(Job),
          useValue: {
            create: vi.fn().mockImplementation((dto) => ({
              ...mockJob,
              ...dto,
            })),
            save: vi.fn().mockImplementation((job) => Promise.resolve(job)),
            findOne: vi.fn().mockResolvedValue(mockJob),
            createQueryBuilder: vi.fn().mockReturnValue({
              leftJoinAndSelect: vi.fn().mockReturnThis(),
              where: vi.fn().mockReturnThis(),
              andWhere: vi.fn().mockReturnThis(),
              orderBy: vi.fn().mockReturnThis(),
              skip: vi.fn().mockReturnThis(),
              take: vi.fn().mockReturnThis(),
              getManyAndCount: vi.fn().mockResolvedValue([[mockJob], 1]),
              getCount: vi.fn().mockResolvedValue(42),
            }),
          },
        },
        {
          provide: getRepositoryToken(Company),
          useValue: {
            findOne: vi.fn().mockResolvedValue(mockCompany),
          },
        },
        {
          provide: getRepositoryToken(SavedJob),
          useValue: {
            find: vi.fn().mockResolvedValue([]),
          },
        },
        {
          provide: getRepositoryToken(Application),
          useValue: {
            find: vi.fn().mockResolvedValue([]),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            find: vi.fn().mockResolvedValue([mockSeeker]),
          },
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
      ],
    }).compile();

    service = module.get<JobsService>(JobsService);
    jobRepo = module.get<Repository<Job>>(getRepositoryToken(Job));
    companyRepo = module.get<Repository<Company>>(getRepositoryToken(Company));
    userRepo = module.get<Repository<User>>(getRepositoryToken(User));
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

    it('should create a job and notify job seekers by default (published)', async () => {
      const result = await service.create('user-1', {
        title: 'Test Job',
        location: 'City',
        description: 'Desc',
      });
      expect(result.id).toBe('job-1');
      expect(userRepo.find).toHaveBeenCalledWith({
        where: {
          role: 'job_seeker',
          isActive: true,
          isBlocked: false,
        },
        select: { id: true },
      });
      expect(mockNotificationsService.notifyNewJobPosted).toHaveBeenCalledWith(
        'job-1',
        'Test Job',
        'City',
        ['seeker-1'],
      );
    });

    it('should create a draft job and not notify job seekers', async () => {
      const result = await service.create('user-1', {
        title: 'Draft Job',
        location: 'City',
        description: 'Desc',
        status: 'draft',
      });
      expect(result.status).toBe('draft');
      expect(
        mockNotificationsService.notifyNewJobPosted,
      ).not.toHaveBeenCalled();
    });

    it('should handle notification errors gracefully without failing job creation', async () => {
      mockNotificationsService.notifyNewJobPosted.mockRejectedValueOnce(
        new Error('FCM Network Error'),
      );
      const result = await service.create('user-1', {
        title: 'Test Job',
        location: 'City',
        description: 'Desc',
      });
      expect(result.id).toBe('job-1');
    });

    it('should create a draft job and not notify job seekers', async () => {
      const result = await service.create('user-1', {
        title: 'Draft Job',
        location: 'City',
        description: 'Desc',
        status: 'draft',
      });
      expect(result.status).toBe('draft');
      expect(
        mockNotificationsService.notifyNewJobPosted,
      ).not.toHaveBeenCalled();
    });

    it('should handle notification errors gracefully without failing job creation', async () => {
      mockNotificationsService.notifyNewJobPosted.mockRejectedValueOnce(
        new Error('FCM Network Error'),
      );
      const result = await service.create('user-1', {
        title: 'Test Job',
        location: 'City',
        description: 'Desc',
      });
      expect(result.id).toBe('job-1');
    });
  });

  describe('update', () => {
    it('should notify job seekers when transitioning a draft job to published', async () => {
      vi.spyOn(jobRepo, 'findOne').mockResolvedValueOnce({
        ...mockJob,
        status: 'draft',
      } as Job);

      const result = await service.update('job-1', 'user-1', {
        status: 'published',
      });

      expect(result.status).toBe('published');
      expect(mockNotificationsService.notifyNewJobPosted).toHaveBeenCalledWith(
        'job-1',
        'Test Job',
        'City',
        ['seeker-1'],
      );
    });

    it('should not notify job seekers when updating an already published job', async () => {
      vi.spyOn(jobRepo, 'findOne').mockResolvedValueOnce({
        ...mockJob,
        status: 'published',
      } as Job);

      await service.update('job-1', 'user-1', {
        title: 'Updated Title',
      });

      expect(
        mockNotificationsService.notifyNewJobPosted,
      ).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should notify job seekers when transitioning a draft job to published', async () => {
      vi.spyOn(jobRepo, 'findOne').mockResolvedValueOnce({
        ...mockJob,
        status: 'draft',
      } as Job);

      const result = await service.update('job-1', 'user-1', {
        status: 'published',
      });

      expect(result.status).toBe('published');
      expect(mockNotificationsService.notifyNewJobPosted).toHaveBeenCalledWith(
        'job-1',
        'Test Job',
        'City',
        ['seeker-1'],
      );
    });

    it('should not notify job seekers when updating an already published job', async () => {
      vi.spyOn(jobRepo, 'findOne').mockResolvedValueOnce({
        ...mockJob,
        status: 'published',
      } as Job);

      await service.update('job-1', 'user-1', {
        title: 'Updated Title',
      });

      expect(
        mockNotificationsService.notifyNewJobPosted,
      ).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('should list all jobs for admin', async () => {
      const result = await service.list(1, 10, 'admin', 'admin-user');
      expect(result.total).toBe(1);
    });

    it('should list only company jobs for company', async () => {
      const result = await service.list(1, 10, 'company', 'user-1');
      expect((result as any).data).toHaveLength(1);
    });

    it('should list published jobs for job_seeker with Flutter shape', async () => {
      const result = await service.list(1, 10, 'job_seeker', 'seeker-1');
      expect((result as any).items).toHaveLength(1);
      const item = (result as any).items[0];
      expect(item.saved).toBe(false);
      expect(item.applied).toBe(false);
      expect(item.company).toBe('Test Company');
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
    it('should moderate a job successfully and notify when published', async () => {
      vi.spyOn(jobRepo, 'findOne').mockResolvedValueOnce({
        ...mockJob,
        status: 'draft',
      } as Job);

      const result = await service.moderate('job-1', {
        status: 'published',
        moderationRemarks: 'Approved',
      });
      expect(result.status).toBe('published');
      expect(mockNotificationsService.notifyNewJobPosted).toHaveBeenCalledWith(
        'job-1',
        'Test Job',
        'City',
        ['seeker-1'],
      );
    });

    it('should moderate a job to rejected without notifying seekers', async () => {
      const saveSpy = vi
        .spyOn(jobRepo, 'save')
        .mockResolvedValueOnce({ ...mockJob, status: 'rejected' } as Job);
      const result = await service.moderate('job-1', {
        status: 'rejected',
        moderationRemarks: 'Violates policy',
      });
      expect(result.status).toBe('rejected');
      expect(saveSpy).toHaveBeenCalled();
      expect(
        mockNotificationsService.notifyNewJobPosted,
      ).not.toHaveBeenCalled();
      expect(
        mockNotificationsService.notifyNewJobPosted,
      ).not.toHaveBeenCalled();
    });
  });

  describe('getJobCounts', () => {
    it('should return activeJobs and newJobsToday counts', async () => {
      const qb: any = {
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getCount: vi
          .fn()
          .mockResolvedValueOnce(125) // activeJobs
          .mockResolvedValueOnce(18), // newJobsToday
      };
      vi.spyOn(jobRepo, 'createQueryBuilder').mockReturnValue(qb);

      const result = await service.getJobCounts();

      expect(result).toEqual({
        activeJobs: 125,
        newJobsToday: 18,
      });
      expect(qb.where).toHaveBeenCalledWith(
        'job.status IN (:...activeStatuses)',
        expect.objectContaining({ activeStatuses: ['published', 'active'] }),
      );
      expect(qb.andWhere).toHaveBeenCalledWith(
        'job.createdAt >= :startOfToday',
        expect.any(Object),
      );
    });

    it('should default counts to 0 if no matching jobs exist', async () => {
      const qb: any = {
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getCount: vi.fn().mockResolvedValue(0),
      };
      vi.spyOn(jobRepo, 'createQueryBuilder').mockReturnValue(qb);

      const result = await service.getJobCounts();

      expect(result).toEqual({
        activeJobs: 0,
        newJobsToday: 0,
      });
    });
  });
});
