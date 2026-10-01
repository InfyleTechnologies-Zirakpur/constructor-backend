import {
  Injectable,
  Logger,
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
import { ConversationsService } from '../conversations/conversations.service.js';
import { User } from '../users/entities/user.entity.js';
import { NotificationsService } from '../notifications/notifications.service.js';

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(
    @InjectRepository(Application)
    private readonly applicationRepository: Repository<Application>,

    @InjectRepository(Job)
    private readonly jobRepository: Repository<Job>,

    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    private readonly conversationsService: ConversationsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Job Seeker applies to a published job.
   * Prevents duplicate applications with a 409 Conflict.
   * Conversation is NOT created here — it is created when the company
   * first responds (via updateStatus with a remark).
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

    const saved = await this.applicationRepository.save(application);

    // Notify company about the new application
    const jobWithCompany = await this.jobRepository.findOne({
      where: { id: jobId },
      relations: { company: true },
    });
    if (jobWithCompany?.company) {
      try {
        const seeker = await this.userRepository.findOne({
          where: { id: userId },
          select: { id: true, fullName: true },
        });
        await this.notificationsService.notifySeekerApplied(
          jobWithCompany.title,
          seeker?.fullName || 'A candidate',
          saved.id,
          jobId,
          jobWithCompany.company.userId,
        );
      } catch (err: any) {
        this.logger.error(
          `Failed to notify company for application ${saved.id}: ${err?.message}`,
          err?.stack,
        );
      }
    }

    return saved;
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

    // Sanitize user data — strip sensitive fields, expose seeker-relevant fields
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
            city: (app.user as any).city ?? null,
            skills: (app.user as any).skills ?? [],
            salaryExpectation: (app.user as any).salaryExpectation ?? null,
            experience: (app.user as any).experience ?? [],
            education: (app.user as any).education ?? [],
            documents: (app.user as any).documents ?? [],
            phoneVerified: (app.user as any).phoneVerified ?? false,
            isVerified: (app.user as any).isVerified ?? false,
            isBlocked: (app.user as any).isBlocked ?? false,
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
   * Company or Admin updates application status (reviewed, shortlisted, accepted, rejected).
   *
   * Flow:
   * 1. Validate and save new status + optional remark on the application.
   * 2. Ensure a conversation exists between company and seeker (create if not).
   * 3. If a remark was provided, send it as a message in that conversation.
   * 4. Notify the seeker about the status change.
   */
  async updateStatus(
    id: string,
    userId: string,
    role: string,
    dto: UpdateApplicationStatusDto,
  ): Promise<Application> {
    const application = await this.applicationRepository.findOne({
      where: { id },
      relations: { job: { company: true } },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (role === 'company') {
      await this.verifyCompanyOwnsJob(application.jobId, userId);
    }

    // Persist status and remark on the application record
    application.status = dto.status;
    if (dto.remark !== undefined) {
      application.companyRemark = dto.remark;
    }
    const saved = await this.applicationRepository.save(application);

    // Determine the company user ID: for 'company' role it is userId,
    // for 'admin' role we derive it from the job's company relation.
    const companyUserId =
      role === 'company' ? userId : (application.job?.company?.userId ?? null);

    if (companyUserId && application.userId) {
      // Ensure a conversation exists (idempotent — no duplicates created)
      let conversation = await this.getOrCreateConversation(
        companyUserId,
        application.userId,
        application.jobId,
        application.id,
      );

      // If a remark was provided and status is accepted/rejected/shortlisted, send it as the first message
      const allowedStatusesForFirstMessage = [
        'shortlisted',
        'accepted',
        'rejected',
      ];
      if (
        allowedStatusesForFirstMessage.includes(dto.status) &&
        dto.remark?.trim() &&
        conversation
      ) {
        try {
          await this.conversationsService.sendMessage(
            conversation.id,
            companyUserId,
            dto.remark.trim(),
          );
        } catch (err: any) {
          this.logger.error(
            `Failed to send remark message for application ${saved.id}: ${err?.message}`,
            err?.stack,
          );
        }
      }
    }

    // Notify the seeker about the status update
    try {
      await this.notificationsService.notifyApplicationStatus(
        application.job?.title || 'the position',
        dto.status,
        application.id,
        application.jobId,
        application.userId,
      );
    } catch (err: any) {
      this.logger.error(
        `Failed to notify seeker for application status update ${saved.id}: ${err?.message}`,
        err?.stack,
      );
    }

    return saved;
  }

  /**
   * Bulk shortlist: Company/Admin can shortlist multiple applications at once.
   * Does not send remarks or create conversations — use updateStatus for that.
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

  /**
   * Helper: safely find or create a conversation, logging errors without throwing.
   * Returns null if the conversation could not be established.
   */
  private async getOrCreateConversation(
    companyUserId: string,
    seekerId: string,
    jobId: string,
    applicationId: string,
  ) {
    try {
      return await this.conversationsService.findOrCreate(
        companyUserId,
        seekerId,
        jobId,
        applicationId,
      );
    } catch (err: any) {
      this.logger.error(
        `Failed to find/create conversation [company=${companyUserId}, seeker=${seekerId}, job=${jobId}]: ${err?.message}`,
        err?.stack,
      );
      return null;
    }
  }
}
