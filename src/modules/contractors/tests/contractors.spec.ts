import { Test, TestingModule } from '@nestjs/testing';
import { ContractorsService } from '../contractors.service.js';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Contractor } from '../entities/contractor.entity.js';
import { Repository } from 'typeorm';
import { ForbiddenException } from '@nestjs/common';
import {
  UpdateContractorDto,
  ContractorVerificationStatus,
} from '../dto/update-contractors.dto.js';

const mockContractor = {
  id: 'contractor-1',
  companyName: 'Test Contractor',
  userId: 'user-1',
  verificationStatus: 'pending',
};

describe('ContractorsService', () => {
  let service: ContractorsService;
  let repository: Repository<Contractor>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContractorsService,
        {
          provide: getRepositoryToken(Contractor),
          useValue: {
            create: vi.fn().mockReturnValue(mockContractor),
            save: vi.fn().mockResolvedValue(mockContractor),
            find: vi.fn().mockResolvedValue([mockContractor]),
            findOne: vi.fn().mockResolvedValue(mockContractor),
            createQueryBuilder: vi.fn().mockReturnValue({
              andWhere: vi.fn().mockReturnThis(),
              skip: vi.fn().mockReturnThis(),
              take: vi.fn().mockReturnThis(),
              orderBy: vi.fn().mockReturnThis(),
              getManyAndCount: vi.fn().mockResolvedValue([[mockContractor], 1]),
            }),
          },
        },
      ],
    }).compile();

    service = module.get<ContractorsService>(ContractorsService);
    repository = module.get<Repository<Contractor>>(
      getRepositoryToken(Contractor),
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a contractor profile', async () => {
      const result = await service.create('user-1', {
        companyName: 'Test Contractor',
        contactEmail: 'test@contractor.com',
        contactPhone: '+919999999999',
      });
      expect(result.companyName).toBe('Test Contractor');
    });
  });

  describe('update', () => {
    it('should throw ForbiddenException if user does not own the contractor profile', async () => {
      vi.spyOn(repository, 'findOne').mockResolvedValueOnce({
        ...mockContractor,
        userId: 'other-user',
      } as Contractor);

      await expect(
        service.update('contractor-1', 'user-1', {} as UpdateContractorDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should update contractor if user owns it', async () => {
      vi.spyOn(repository, 'save').mockImplementationOnce(async (c: any) => c);
      const result = await service.update('contractor-1', 'user-1', {
        companyName: 'Updated Name',
      } as UpdateContractorDto);
      expect(result.companyName).toBe('Updated Name');
    });
  });

  describe('verifyContractor', () => {
    it('should update verification status', async () => {
      vi.spyOn(repository, 'save').mockImplementation(async (c: any) => c);
      const result = await service.verifyContractor('contractor-1', {
        verificationStatus: ContractorVerificationStatus.VERIFIED,
        verificationRemarks: 'Documents verified',
      });
      expect(result.verificationStatus).toBe(
        ContractorVerificationStatus.VERIFIED,
      );
      expect(result.verificationRemarks).toBe('Documents verified');
    });
  });

  describe('findAll', () => {
    it('should return paginated results', async () => {
      const result = await service.findAll(1, 10);
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });
});
