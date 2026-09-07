import { Test, TestingModule } from '@nestjs/testing';
import { CompaniesService } from '../companies.service.js';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Company } from '../entities/company.entity.js';
import { Repository } from 'typeorm';
import { ForbiddenException } from '@nestjs/common';
import {
  UpdateCompanyDto,
  CompanyVerificationStatus,
} from '../dto/update-companies.dto.js';

const mockCompany = {
  id: 'company-1',
  name: 'Test Company',
  userId: 'user-1',
  verificationStatus: 'pending',
};

describe('CompaniesService', () => {
  let service: CompaniesService;
  let repository: Repository<Company>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompaniesService,
        {
          provide: getRepositoryToken(Company),
          useValue: {
            create: vi.fn().mockReturnValue(mockCompany),
            save: vi.fn().mockResolvedValue(mockCompany),
            find: vi.fn().mockResolvedValue([mockCompany]),
            findOne: vi.fn().mockResolvedValue(mockCompany),
            createQueryBuilder: vi.fn().mockReturnValue({
              andWhere: vi.fn().mockReturnThis(),
              skip: vi.fn().mockReturnThis(),
              take: vi.fn().mockReturnThis(),
              orderBy: vi.fn().mockReturnThis(),
              getManyAndCount: vi.fn().mockResolvedValue([[mockCompany], 1]),
            }),
          },
        },
      ],
    }).compile();

    service = module.get<CompaniesService>(CompaniesService);
    repository = module.get<Repository<Company>>(getRepositoryToken(Company));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('update', () => {
    it('should throw ForbiddenException if user does not own the company', async () => {
      vi.spyOn(repository, 'findOne').mockResolvedValueOnce({
        ...mockCompany,
        userId: 'other-user',
      } as Company);

      await expect(
        service.update('company-1', 'user-1', {} as UpdateCompanyDto),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should update company if user owns it', async () => {
      vi.spyOn(repository, 'save').mockImplementationOnce(async (c: any) => c);
      const result = await service.update('company-1', 'user-1', {
        name: 'Updated',
      } as UpdateCompanyDto);
      expect(result.name).toBe('Updated');
    });
  });

  describe('verifyCompany', () => {
    it('should update verification status', async () => {
      vi.spyOn(repository, 'save').mockImplementation(async (c: any) => c);
      const result = await service.verifyCompany('company-1', {
        verificationStatus: CompanyVerificationStatus.VERIFIED,
        verificationRemarks: 'All clear',
      });
      expect(result.verificationStatus).toBe(
        CompanyVerificationStatus.VERIFIED,
      );
      expect(result.verificationRemarks).toBe('All clear');
    });
  });
});
