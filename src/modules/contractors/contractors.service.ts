import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contractor } from './entities/contractor.entity.js';
import { CreateContractorDto } from './dto/create-contractors.dto.js';
import {
  AdminVerifyContractorDto,
  UpdateContractorDto,
} from './dto/update-contractors.dto.js';

@Injectable()
export class ContractorsService {
  constructor(
    @InjectRepository(Contractor)
    private contractorsRepository: Repository<Contractor>,
  ) {}

  async create(userId: string, dto: CreateContractorDto): Promise<Contractor> {
    const contractor = this.contractorsRepository.create({
      ...dto,
      userId,
      verificationStatus: 'pending',
    });
    return this.contractorsRepository.save(contractor);
  }

  async findMyProfile(userId: string): Promise<Contractor[]> {
    return this.contractorsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async update(
    id: string,
    userId: string,
    dto: UpdateContractorDto,
  ): Promise<Contractor> {
    const contractor = await this.contractorsRepository.findOne({
      where: { id },
    });

    if (!contractor) {
      throw new NotFoundException('Contractor profile not found');
    }

    if (contractor.userId !== userId) {
      throw new ForbiddenException('You do not own this contractor profile');
    }

    Object.assign(contractor, dto);
    return this.contractorsRepository.save(contractor);
  }

  async findAll(
    page: number = 1,
    limit: number = 10,
    status?: string,
  ): Promise<{ data: Contractor[]; total: number }> {
    const query = this.contractorsRepository.createQueryBuilder('contractor');

    if (status) {
      query.andWhere('contractor.verificationStatus = :status', { status });
    }

    query.skip((page - 1) * limit).take(limit);
    query.orderBy('contractor.createdAt', 'DESC');

    const [data, total] = await query.getManyAndCount();

    return { data, total };
  }

  async findOne(id: string): Promise<Contractor> {
    const contractor = await this.contractorsRepository.findOne({
      where: { id },
    });
    if (!contractor) {
      throw new NotFoundException('Contractor not found');
    }
    return contractor;
  }

  async verifyContractor(
    id: string,
    dto: AdminVerifyContractorDto,
  ): Promise<Contractor> {
    const contractor = await this.findOne(id);
    contractor.verificationStatus = dto.verificationStatus;
    if (dto.verificationRemarks !== undefined) {
      contractor.verificationRemarks = dto.verificationRemarks;
    }
    return this.contractorsRepository.save(contractor);
  }
}
