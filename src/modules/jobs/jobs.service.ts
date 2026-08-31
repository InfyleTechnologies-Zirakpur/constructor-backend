import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from './entities/job.entity.js';

export type JobStatus = 'draft' | 'published' | 'closed';

@Injectable()
export class JobsService {
  constructor(
    @InjectRepository(Job) private readonly jobRepository: Repository<Job>,
  ) {}

  async list(page: number, limit: number) {
    const [items, total] = await this.jobRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      items,
      page,
      limit,
      total,
    };
  }

  async getById(id: string) {
    const job = await this.jobRepository.findOne({ where: { id } });
    if (!job) {
      throw new NotFoundException('Job not found');
    }
    return job;
  }

  async create(dto: Partial<Job>) {
    const job = this.jobRepository.create({
      title: dto.title ?? 'Untitled Job',
      companyId: dto.companyId ?? 'company-1',
      location: dto.location ?? 'Location TBD',
      skills: dto.skills ?? [],
      description: dto.description ?? '',
      compensation: Number(dto.compensation) || 0,
      workforceRequired: dto.workforceRequired ?? 1,
      status: 'draft',
    });

    return this.jobRepository.save(job);
  }
}
