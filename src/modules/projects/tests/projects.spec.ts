import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsService } from '../projects.service.js';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Project } from '../entities/project.entity.js';
import { Contractor } from '../../contractors/entities/contractor.entity.js';
import { Repository } from 'typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CreateProjectDto } from '../dto/create-projects.dto.js';

const mockProject = {
  id: 'project-1',
  name: 'Test Project',
  contractorId: 'contractor-1',
  status: 'draft',
};

const mockContractor = {
  id: 'contractor-1',
  userId: 'user-1',
};

describe('ProjectsService', () => {
  let service: ProjectsService;
  let projectRepo: Repository<Project>;
  let contractorRepo: Repository<Contractor>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        {
          provide: getRepositoryToken(Project),
          useValue: {
            create: vi.fn().mockReturnValue(mockProject),
            save: vi.fn().mockResolvedValue(mockProject),
            findOne: vi.fn().mockResolvedValue(mockProject),
            createQueryBuilder: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnThis(),
              andWhere: vi.fn().mockReturnThis(),
              leftJoinAndSelect: vi.fn().mockReturnThis(),
              skip: vi.fn().mockReturnThis(),
              take: vi.fn().mockReturnThis(),
              orderBy: vi.fn().mockReturnThis(),
              getManyAndCount: vi.fn().mockResolvedValue([[mockProject], 1]),
            }),
          },
        },
        {
          provide: getRepositoryToken(Contractor),
          useValue: {
            findOne: vi.fn().mockResolvedValue(mockContractor),
          },
        },
      ],
    }).compile();

    service = module.get<ProjectsService>(ProjectsService);
    projectRepo = module.get<Repository<Project>>(getRepositoryToken(Project));
    contractorRepo = module.get<Repository<Contractor>>(
      getRepositoryToken(Contractor),
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should throw NotFoundException if contractor profile is not found', async () => {
      vi.spyOn(contractorRepo, 'findOne').mockResolvedValueOnce(null);
      await expect(
        service.create('user-1', {} as CreateProjectDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create a project successfully', async () => {
      const result = await service.create('user-1', {
        name: 'New Project',
        location: 'City',
      });
      expect(result.name).toBe('Test Project'); // Returns mocked save result
    });
  });

  describe('findOne', () => {
    it('should throw ForbiddenException if contractor does not own the project', async () => {
      // Mock that the requesting user's contractor profile is different
      vi.spyOn(contractorRepo, 'findOne').mockResolvedValueOnce({
        id: 'contractor-2', // Different from project-1's contractorId
        userId: 'user-2',
      } as Contractor);

      await expect(service.findOne('project-1', 'user-2')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow admin to find any project', async () => {
      // Admin passes undefined for userId
      const result = await service.findOne('project-1');
      expect(result.id).toBe('project-1');
    });
  });

  describe('findMyProjects', () => {
    it('should return empty if contractor profile not found', async () => {
      vi.spyOn(contractorRepo, 'findOne').mockResolvedValueOnce(null);
      const result = await service.findMyProjects('user-no-profile');
      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should return paginated projects', async () => {
      const result = await service.findMyProjects('user-1');
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });
});
