import { Test, TestingModule } from '@nestjs/testing';
import { ProjectSitesService } from '../project-sites.service.js';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProjectSite } from '../entities/project-site.entity.js';
import { Project } from '../../projects/entities/project.entity.js';
import { Contractor } from '../../contractors/entities/contractor.entity.js';
import { User } from '../../users/entities/user.entity.js';
import { SiteEngineerAssignment } from '../../site-engineers/entities/site-engineer-assignment.entity.js';
import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

const mockContractor = { id: 'contractor-1', userId: 'user-1' };
const mockProject = {
  id: 'project-1',
  contractorId: 'contractor-1',
};
const mockSite = {
  id: 'site-1',
  name: 'Site A',
  projectId: 'project-1',
  status: 'active',
  project: mockProject,
};

describe('ProjectSitesService', () => {
  let service: ProjectSitesService;

  const siteRepo = {
    create: vi.fn().mockReturnValue(mockSite),
    save: vi.fn().mockResolvedValue(mockSite),
    find: vi.fn().mockResolvedValue([mockSite]),
    findOne: vi.fn().mockResolvedValue(mockSite),
  };

  const projectRepo = {
    findOne: vi.fn().mockResolvedValue(mockProject),
  };

  const contractorRepo = {
    findOne: vi.fn().mockResolvedValue(mockContractor),
  };

  const userRepo = {
    findOne: vi.fn(),
  };

  const assignmentRepo = {
    create: vi.fn(),
    save: vi.fn(),
    find: vi.fn().mockResolvedValue([]),
    findOne: vi.fn().mockResolvedValue(null),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset defaults
    contractorRepo.findOne.mockResolvedValue(mockContractor);
    projectRepo.findOne.mockResolvedValue(mockProject);
    siteRepo.findOne.mockResolvedValue(mockSite);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectSitesService,
        { provide: getRepositoryToken(ProjectSite), useValue: siteRepo },
        { provide: getRepositoryToken(Project), useValue: projectRepo },
        { provide: getRepositoryToken(Contractor), useValue: contractorRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        {
          provide: getRepositoryToken(SiteEngineerAssignment),
          useValue: assignmentRepo,
        },
      ],
    }).compile();

    service = module.get<ProjectSitesService>(ProjectSitesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a site under a project', async () => {
      const result = await service.create('project-1', 'user-1', {
        name: 'Site A',
        location: 'Block A',
      });
      expect(result.name).toBe('Site A');
    });

    it('should throw ForbiddenException if contractor does not own the project', async () => {
      contractorRepo.findOne.mockResolvedValueOnce({
        id: 'contractor-2',
        userId: 'user-1',
      });

      await expect(
        service.create('project-1', 'user-1', {
          name: 'Site B',
          location: 'Block B',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if project does not exist', async () => {
      projectRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.create('nonexistent', 'user-1', {
          name: 'Site B',
          location: 'Block B',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('assignEngineer', () => {
    it('should throw BadRequestException if user is not a site_engineer', async () => {
      userRepo.findOne.mockResolvedValueOnce({
        id: 'eng-1',
        role: 'contractor',
      });

      await expect(
        service.assignEngineer('site-1', 'user-1', { userId: 'eng-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if user does not exist', async () => {
      userRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.assignEngineer('site-1', 'user-1', { userId: 'eng-1' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should assign engineer successfully', async () => {
      userRepo.findOne.mockResolvedValueOnce({
        id: 'eng-1',
        role: 'site_engineer',
      });
      assignmentRepo.findOne.mockResolvedValueOnce(null);
      const mockAssignment = {
        id: 'assign-1',
        siteId: 'site-1',
        userId: 'eng-1',
      };
      assignmentRepo.create.mockReturnValue(mockAssignment);
      assignmentRepo.save.mockResolvedValueOnce(mockAssignment);

      const result = await service.assignEngineer('site-1', 'user-1', {
        userId: 'eng-1',
      });
      expect(result.siteId).toBe('site-1');
      expect(result.userId).toBe('eng-1');
    });

    it('should throw BadRequestException if engineer already assigned', async () => {
      userRepo.findOne.mockResolvedValueOnce({
        id: 'eng-1',
        role: 'site_engineer',
      });
      assignmentRepo.findOne.mockResolvedValueOnce({
        id: 'existing',
        isActive: true,
      });

      await expect(
        service.assignEngineer('site-1', 'user-1', { userId: 'eng-1' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findMySites', () => {
    it('should return sites assigned to the engineer', async () => {
      assignmentRepo.find.mockResolvedValueOnce([
        { site: mockSite, userId: 'eng-1', isActive: true },
      ]);

      const result = await service.findMySites('eng-1');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Site A');
    });
  });
});
