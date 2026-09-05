import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from './entities/job.entity.js';
import { Company } from '../companies/entities/company.entity.js';
import { CreateJobDto } from './dto/create-jobs.dto.js';
import { UpdateJobDto, ModerateJobDto } from './dto/update-jobs.dto.js';

@Injectable()
export class JobsService {
  constructor(
    @InjectRepository(Job) private readonly jobRepository: Repository<Job>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
  ) {}

  /**
   * Helper to verify that the requesting user owns the company that owns the job.
   */
  private async verifyCompanyOwnership(
    job: Job,
    userId: string,
  ): Promise<void> {
    const company = await this.companyRepository.findOne({
      where: { userId },
    });

    if (!company || job.companyId !== company.id) {
      throw new ForbiddenException('You do not have access to this job');
    }
  }

  /**
   * Company creates a new job.
   */
  async create(userId: string, dto: CreateJobDto): Promise<Job> {
    const company = await this.companyRepository.findOne({
      where: { userId },
    });

    if (!company) {
      throw new NotFoundException(
        'Company profile not found. Please create a company profile first.',
      );
    }

    const job = this.jobRepository.create({
      ...dto,
      companyId: company.id,
      status: 'draft',
    });

    return this.jobRepository.save(job);
  }

  /**
   * List jobs based on role.
   * - Admin: sees all jobs (paginated).
   * - Company: sees only their own jobs.
   * - Job Seeker: sees only `published` jobs.
   */
  async list(page: number, limit: number, role: string, userId: string) {
    const query = this.jobRepository.createQueryBuilder('job');

    if (role === 'company') {
      const company = await this.companyRepository.findOne({
        where: { userId },
      });
      if (company) {
        query.where('job.companyId = :companyId', { companyId: company.id });
      } else {
        return { data: [], total: 0 };
      }
    } else if (role === 'job_seeker') {
      query.where('job.status = :status', { status: 'published' });
    }

    query.orderBy('job.createdAt', 'DESC');
    query.skip((page - 1) * limit).take(limit);

    const [data, total] = await query.getManyAndCount();

    return { data, total, page, limit };
  }

  /**
   * Get job by ID.
   * - Job Seeker: can only view if `published`.
   * - Company: can only view if they own it.
   * - Admin: can view any.
   */
  async getById(id: string, role: string, userId: string): Promise<Job> {
    const job = await this.jobRepository.findOne({
      where: { id },
      relations: { company: true },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (role === 'job_seeker' && job.status !== 'published') {
      throw new NotFoundException('Job not found or not published');
    }

    if (role === 'company') {
      await this.verifyCompanyOwnership(job, userId);
    }

    return job;
  }

  /**
   * Company updates their job.
   */
  async update(id: string, userId: string, dto: UpdateJobDto): Promise<Job> {
    const job = await this.jobRepository.findOne({ where: { id } });
    if (!job) throw new NotFoundException('Job not found');

    await this.verifyCompanyOwnership(job, userId);

    Object.assign(job, dto);
    return this.jobRepository.save(job);
  }

  /**
   * Company closes their job.
   */
  async close(id: string, userId: string): Promise<Job> {
    const job = await this.jobRepository.findOne({ where: { id } });
    if (!job) throw new NotFoundException('Job not found');

    await this.verifyCompanyOwnership(job, userId);

    job.status = 'closed';
    return this.jobRepository.save(job);
  }

  /**
   * Admin moderates a job (e.g., rejecting it for violations).
   */
  async moderate(id: string, dto: ModerateJobDto): Promise<Job> {
    const job = await this.jobRepository.findOne({ where: { id } });
    if (!job) throw new NotFoundException('Job not found');

    job.status = dto.status;
    if (dto.moderationRemarks !== undefined) {
      job.moderationRemarks = dto.moderationRemarks;
    }

    return this.jobRepository.save(job);
  }
}
