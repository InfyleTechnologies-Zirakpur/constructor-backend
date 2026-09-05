import { Test, TestingModule } from '@nestjs/testing';
import { SiteEngineersService } from '../site-engineers.service.js';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../../users/entities/user.entity.js';
import { SiteEngineerAssignment } from '../entities/site-engineer-assignment.entity.js';
import { Contractor } from '../../contractors/entities/contractor.entity.js';
import { ProjectSite } from '../../project-sites/entities/project-site.entity.js';
import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

vi.mock('bcryptjs', () => ({
  hash: vi.fn().mockResolvedValue('hashed-password'),
}));

describe('SiteEngineersService', () => {
  let service: SiteEngineersService;

  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    role: 'site_engineer',
    passwordHash: 'hashed-password',
  };

  const mockContractor = {
    id: 'contractor-1',
    userId: 'contractor-user-1',
  };

  const userRepo = {
    findOne: vi.fn(),
    find: vi.fn().mockResolvedValue([mockUser]),
    create: vi.fn().mockReturnValue(mockUser),
    save: vi.fn().mockResolvedValue(mockUser),
  };

  const assignmentRepo = {
    createQueryBuilder: vi.fn().mockReturnValue({
      innerJoinAndSelect: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue([
        {
          user: mockUser,
          site: { id: 'site-1', project: { contractorId: 'contractor-1' } },
        },
      ]),
    }),
    find: vi
      .fn()
      .mockResolvedValue([
        { id: 'assign-1', site: { project: { contractorId: 'contractor-1' } } },
      ]),
  };

  const contractorRepo = {
    findOne: vi.fn().mockResolvedValue(mockContractor),
  };

  const siteRepo = {};

  beforeEach(async () => {
    vi.clearAllMocks();
    contractorRepo.findOne.mockResolvedValue(mockContractor);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SiteEngineersService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        {
          provide: getRepositoryToken(SiteEngineerAssignment),
          useValue: assignmentRepo,
        },
        { provide: getRepositoryToken(Contractor), useValue: contractorRepo },
        { provide: getRepositoryToken(ProjectSite), useValue: siteRepo },
      ],
    }).compile();

    service = module.get<SiteEngineersService>(SiteEngineersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createSiteEngineer', () => {
    it('should throw BadRequestException if email exists', async () => {
      userRepo.findOne.mockResolvedValueOnce(mockUser);
      await expect(
        service.createSiteEngineer({
          email: 'test@example.com',
          fullName: 'Test Eng',
          password: 'password123',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create and sanitize a new site engineer', async () => {
      userRepo.findOne.mockResolvedValueOnce(null);
      const result = await service.createSiteEngineer({
        email: 'new@example.com',
        fullName: 'Test Eng',
        password: 'password123',
      });
      expect(result).not.toHaveProperty('passwordHash');
      expect(result.email).toBe('test@example.com'); // Mock returns mockUser
    });
  });

  describe('listEngineers', () => {
    it('should allow admin to list all engineers', async () => {
      const result = await service.listEngineers('admin-id', 'admin');
      expect(userRepo.find).toHaveBeenCalled();
      expect(result.data).toHaveLength(1);
    });

    it('should allow contractor to list assigned engineers', async () => {
      const result = await service.listEngineers(
        'contractor-user-1',
        'contractor',
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0].email).toBe('test@example.com');
    });

    it('should throw NotFoundException if contractor not found', async () => {
      contractorRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        service.listEngineers('user-no-profile', 'contractor'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getProfile', () => {
    it('should throw NotFoundException if engineer does not exist', async () => {
      userRepo.findOne.mockResolvedValueOnce(null);
      await expect(
        service.getProfile('eng-1', 'admin-1', 'admin'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow site_engineer to view their own profile', async () => {
      userRepo.findOne.mockResolvedValueOnce(mockUser);
      const result = await service.getProfile(
        'user-1',
        'user-1',
        'site_engineer',
      );
      expect(result.engineer.id).toBe('user-1');
      expect(result.activeAssignments).toHaveLength(1);
    });

    it('should forbid site_engineer from viewing other profiles', async () => {
      userRepo.findOne.mockResolvedValueOnce(mockUser);
      await expect(
        service.getProfile('user-1', 'user-2', 'site_engineer'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow contractor to view assigned engineer profile', async () => {
      userRepo.findOne.mockResolvedValueOnce(mockUser);
      const result = await service.getProfile(
        'user-1',
        'contractor-user-1',
        'contractor',
      );
      expect(result.engineer.id).toBe('user-1');
    });

    it('should forbid contractor from viewing unassigned engineer', async () => {
      userRepo.findOne.mockResolvedValueOnce(mockUser);
      // Mock assignment belonging to a DIFFERENT contractor
      assignmentRepo.find.mockResolvedValueOnce([
        {
          id: 'assign-1',
          site: { project: { contractorId: 'different-contractor' } },
        },
      ]);
      await expect(
        service.getProfile('user-1', 'contractor-user-1', 'contractor'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
