import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Application } from './entities/application.entity.js';
import { Job } from '../jobs/entities/job.entity.js';
import { Company } from '../companies/entities/company.entity.js';
import { CreateApplicationDto } from './dto/create-applications.dto.js';
import { UpdateApplicationStatusDto } from './dto/update-applications.dto.js';

@Injectable()
export class ApplicationsService {
  constructor(
    @InjectRepository(Application)
    private readonly applicationRepository: Repository<Application>,

    @InjectRepository(Job)
    private readonly jobRepository: Repository<Job>,

    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
  ) {}

  /**
   * Job Seeker applies to a published job.
   * Prevents duplicate applications with a 409 Conflict.
   */
  async apply(
    jobId: string,
    userId: string,
    dto: CreateApplicationDto,
  ): Promise<Application> {
    const job = await this.jobRepository.findOne({ where: { id: jobId } });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.status !== 'published') {
      throw new ForbiddenException('You can only apply to published jobs');
    }

    const existing = await this.applicationRepository.findOne({
      where: { jobId, userId },
    });

    if (existing) {
      throw new ConflictException('You have already applied to this job');
    }

    const application = this.applicationRepository.create({
      jobId,
      userId,
      status: 'pending',
      coverNote: dto.coverNote,
      experience: dto.experience,
      summary: dto.summary,
      availability: dto.availability,
    });

    return this.applicationRepository.save(application);
  }

  /**
   * List applications based on role.
   * - Job Seeker: sees only their own applications (with job details).
   * - Company: sees applications for their jobs.
   * - Admin: sees all applications.
   */
  async list(
    role: string,
    userId: string,
    page: number,
    limit: number,
    statusFilter?: string,
  ) {
    const query = this.applicationRepository
      .createQueryBuilder('application')
      .leftJoinAndSelect('application.job', 'job')
      .leftJoinAndSelect('application.user', 'user');

    if (role === 'job_seeker') {
      query.where('application.userId = :userId', { userId });
    } else if (role === 'company') {
      const company = await this.companyRepository.findOne({
        where: { userId },
      });

      if (!company) {
        return { data: [], total: 0, page, limit };
      }

      query.where('job.companyId = :companyId', {
        companyId: company.id,
      });
    }

    if (statusFilter) {
      query.andWhere('application.status = :status', {
        status: statusFilter,
      });
    }

    query.orderBy('application.createdAt', 'DESC');
    query.skip((page - 1) * limit).take(limit);

    const [data, total] = await query.getManyAndCount();

    // Sanitize user data — strip passwordHash, otpHash, refreshTokenHash
    const sanitized = data.map((app) => ({
      ...app,
      user: app.user
        ? {
            id: app.user.id,
            fullName: app.user.fullName,
            email: app.user.email,
            phone: app.user.phone,
            role: app.user.role,
            avatarUrl: app.user.avatarUrl,
          }
        : undefined,
    }));

    return { data: sanitized, total, page, limit };
  }

  /**
   * Get a single application by ID.
   * - Job Seeker: only their own.
   * - Company: only applications to their jobs.
   * - Admin: any.
   */
  async getById(
    id: string,
    role: string,
    userId: string,
  ): Promise<Application> {
    const application = await this.applicationRepository.findOne({
      where: { id },
      relations: { job: true, user: true },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (role === 'job_seeker' && application.userId !== userId) {
      throw new ForbiddenException('You can only view your own applications');
    }

    if (role === 'company') {
      await this.verifyCompanyOwnsJob(application.jobId, userId);
    }

    return application;
  }

  /**
   * Company or Admin updates application status (review, shortlist, accept, reject).
   */
  async updateStatus(
    id: string,
    userId: string,
    role: string,
    dto: UpdateApplicationStatusDto,
  ): Promise<Application> {
    const application = await this.applicationRepository.findOne({
      where: { id },
      relations: { job: true },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (role === 'company') {
      await this.verifyCompanyOwnsJob(application.jobId, userId);
    }

    application.status = dto.status;

    if (dto.rejectionReason !== undefined) {
      application.rejectionReason = dto.rejectionReason;
    }

    return this.applicationRepository.save(application);
  }

  /**
   * Bulk shortlist: Company/Admin can shortlist multiple applications at once.
   */
  async bulkShortlist(
    applicationIds: string[],
    userId: string,
    role: string,
  ): Promise<{ updated: number }> {
    let updated = 0;

    for (const id of applicationIds) {
      const application = await this.applicationRepository.findOne({
        where: { id },
        relations: { job: true },
      });

      if (!application) continue;

      if (role === 'company') {
        try {
          await this.verifyCompanyOwnsJob(application.jobId, userId);
        } catch {
          continue;
        }
      }

      application.status = 'shortlisted';
      await this.applicationRepository.save(application);
      updated++;
    }

    return { updated };
  }

  /**
   * Job Seeker withdraws their application (soft-delete by setting status to "withdrawn").
   */
  async withdraw(id: string, userId: string): Promise<Application> {
    const application = await this.applicationRepository.findOne({
      where: { id },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (application.userId !== userId) {
      throw new ForbiddenException(
        'You can only withdraw your own applications',
      );
    }

    if (application.status === 'accepted') {
      throw new ForbiddenException('Cannot withdraw an accepted application');
    }

    application.status = 'withdrawn';
    return this.applicationRepository.save(application);
  }

  /**
   * Helper: verify that the user owns the company that posted the job.
   */
  private async verifyCompanyOwnsJob(
    jobId: string,
    userId: string,
  ): Promise<void> {
    const job = await this.jobRepository.findOne({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    const company = await this.companyRepository.findOne({
      where: { userId },
    });

    if (!company || job.companyId !== company.id) {
      throw new ForbiddenException(
        'You do not have access to this application',
      );
    }
  }
}
