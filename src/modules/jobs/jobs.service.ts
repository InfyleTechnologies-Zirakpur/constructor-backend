import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from './entities/job.entity.js';
import { SavedJob } from './entities/saved-job.entity.js';
import { Application } from '../applications/entities/application.entity.js';
import { Company } from '../companies/entities/company.entity.js';
import { CreateJobDto } from './dto/create-jobs.dto.js';
import { UpdateJobDto, ModerateJobDto } from './dto/update-jobs.dto.js';

interface JobFilters {
  search?: string;
  location?: string;
  minDailyPay?: string;
  skill?: string;
  projectType?: string;
  experienceLevel?: string;
}

@Injectable()
export class JobsService {
  constructor(
    @InjectRepository(Job) private readonly jobRepository: Repository<Job>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(SavedJob)
    private readonly savedJobRepository: Repository<SavedJob>,
    @InjectRepository(Application)
    private readonly applicationRepository: Repository<Application>,
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
   * - Job Seeker: sees only `published` jobs, with Flutter-compatible shape.
   */
  async list(
    page: number,
    limit: number,
    role: string,
    userId: string,
    filters?: JobFilters,
  ) {
    const query = this.jobRepository
      .createQueryBuilder('job')
      .leftJoinAndSelect('job.company', 'company');

    if (role === 'company') {
      const company = await this.companyRepository.findOne({
        where: { userId },
      });
      if (company) {
        query.where('job.companyId = :companyId', { companyId: company.id });
      } else {
        return { items: [], total: 0 };
      }
    } else if (role === 'job_seeker') {
      query.where('job.status = :status', { status: 'published' });
    }

    // Apply Flutter search filters
    if (filters?.search) {
      query.andWhere(
        '(LOWER(job.title) LIKE :search OR LOWER(job.description) LIKE :search)',
        { search: `%${filters.search.toLowerCase()}%` },
      );
    }
    if (filters?.location) {
      query.andWhere('LOWER(job.location) LIKE :location', {
        location: `%${filters.location.toLowerCase()}%`,
      });
    }
    if (filters?.minDailyPay) {
      query.andWhere('job.dailyPay >= :minPay', {
        minPay: Number(filters.minDailyPay),
      });
    }
    if (filters?.projectType) {
      query.andWhere('job.projectType = :projectType', {
        projectType: filters.projectType,
      });
    }
    if (filters?.experienceLevel) {
      query.andWhere('job.experienceLevel = :experienceLevel', {
        experienceLevel: filters.experienceLevel,
      });
    }

    query.orderBy('job.createdAt', 'DESC');
    query.skip((page - 1) * limit).take(limit);

    const [jobs, total] = await query.getManyAndCount();

    // For job_seeker: return Flutter-compatible shape with saved/applied flags
    if (role === 'job_seeker') {
      const savedJobs = await this.savedJobRepository.find({
        where: { userId },
      });
      const savedJobIds = new Set(savedJobs.map((s) => s.jobId));

      const applications = await this.applicationRepository.find({
        where: { userId },
      });
      const appliedJobIds = new Set(applications.map((a) => a.jobId));

      const items = jobs.map((job) => ({
        id: job.id,
        title: job.title,
        company: job.company?.name ?? 'Unknown',
        location: job.location,
        dailyPay: job.dailyPay || Number(job.compensation) || 0,
        skills: job.skills ?? [],
        description: job.description ?? '',
        requirements: job.requirements ?? [],
        saved: savedJobIds.has(job.id),
        applied: appliedJobIds.has(job.id),
        projectType: job.projectType ?? 'Full-time',
        experienceLevel: job.experienceLevel ?? 'Any',
      }));

      return { items, total };
    }

    return { data: jobs, total, page, limit };
  }

  /**
   * Get job by ID.
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
