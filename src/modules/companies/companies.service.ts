import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from './entities/company.entity.js';
import { CreateCompanyDto } from './dto/create-companies.dto.js';
import {
  AdminVerifyCompanyDto,
  UpdateCompanyDto,
} from './dto/update-companies.dto.js';

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company)
    private companiesRepository: Repository<Company>,
  ) {}

  async create(userId: string, dto: CreateCompanyDto): Promise<Company> {
    const company = this.companiesRepository.create({
      ...dto,
      userId,
      verificationStatus: 'pending',
    });
    return this.companiesRepository.save(company);
  }

  async findMyCompanies(userId: string): Promise<Company[]> {
    return this.companiesRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * GET /companies/user/:userId
   * Full company profile behind a user (author) id — used when tapping a
   * company that posted in the feed. Never returns password/hash fields.
   */
  async findByUserId(userId: string): Promise<Record<string, any>> {
    const company = await this.companiesRepository.findOne({
      where: { userId },
      relations: { user: true },
      order: { createdAt: 'DESC' },
    });

    if (!company) {
      throw new NotFoundException('Company profile not found for this user');
    }

    const { user, registrationNumber, panNumber, documentUrls, ...rest } =
      company as Company & Record<string, any>;
    return {
      ...rest,
      owner: user
        ? {
            id: user.id,
            fullName: user.fullName,
            email: user.email,
            phone: user.phone ?? null,
            avatarUrl: user.avatarUrl ?? null,
            role: user.role,
          }
        : null,
    };
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateCompanyDto,
  ): Promise<Company> {
    const company = await this.companiesRepository.findOne({
      where: { id },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    if (company.userId !== userId) {
      throw new ForbiddenException('You do not own this company profile');
    }

    Object.assign(company, dto);
    return this.companiesRepository.save(company);
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    status?: string,
  ): Promise<{ data: Company[]; total: number }> {
    const query = this.companiesRepository.createQueryBuilder('company');

    if (status) {
      query.andWhere('company.verificationStatus = :status', { status });
    }

    query.skip((page - 1) * limit).take(limit);
    query.orderBy('company.createdAt', 'DESC');

    const [data, total] = await query.getManyAndCount();

    return { data, total };
  }

  async findOne(id: string): Promise<Company> {
    const company = await this.companiesRepository.findOne({ where: { id } });
    if (!company) {
      throw new NotFoundException('Company not found');
    }
    return company;
  }

  async verifyCompany(
    id: string,
    dto: AdminVerifyCompanyDto,
  ): Promise<Company> {
    const company = await this.findOne(id);
    company.verificationStatus = dto.verificationStatus;
    if (dto.verificationRemarks !== undefined) {
      company.verificationRemarks = dto.verificationRemarks;
    }
    return this.companiesRepository.save(company);
  }
}
