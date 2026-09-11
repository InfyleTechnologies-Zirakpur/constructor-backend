import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity.js';
import { Job } from '../jobs/entities/job.entity.js';
import { SavedJob } from '../jobs/entities/saved-job.entity.js';
import { Application } from '../applications/entities/application.entity.js';
import { Attendance } from '../attendance/entities/attendance.entity.js';
import { Notification } from '../notifications/entities/notification.entity.js';
import { Document } from '../documents/entities/document.entity.js';
import { Company } from '../companies/entities/company.entity.js';

@Injectable()
export class WorkerAppService {
  private readonly logger = new Logger(WorkerAppService.name);

  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Job) private readonly jobRepo: Repository<Job>,
    @InjectRepository(SavedJob)
    private readonly savedJobRepo: Repository<SavedJob>,
    @InjectRepository(Application)
    private readonly applicationRepo: Repository<Application>,
    @InjectRepository(Attendance)
    private readonly attendanceRepo: Repository<Attendance>,
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
  ) {}

  // ════════════════════════════════════════════════════
  //  WORKER PROFILE SHAPE
  // ════════════════════════════════════════════════════

  private buildWorkerProfile(user: User) {
    return {
      id: user.id,
      name: user.fullName,
      phone: user.phone ?? '',
      city: user.city ?? '',
      skills: user.skills ?? [],
      profilePhotoUrl: user.avatarUrl ?? null,
      documents: [] as any[],
      salaryExpectation: user.salaryExpectation ?? '',
    };
  }

  // ════════════════════════════════════════════════════
  //  PROFILE CRUD
  // ════════════════════════════════════════════════════

  async getWorkerProfile(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const documents = await this.documentRepo.find({
      where: { ownerId: userId },
      order: { createdAt: 'DESC' },
    });

    const profile = this.buildWorkerProfile(user);
    profile.documents = documents.map((doc) => ({
      id: doc.id,
      type: doc.entityType,
      name: doc.originalFilename,
      verificationStatus: 'pending',
    }));

    return profile;
  }

  async updateWorkerProfile(userId: string, body: Record<string, any>) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // Map Flutter field names to entity fields
    if (body.name !== undefined) user.fullName = body.name;
    if (body.city !== undefined) user.city = body.city;
    if (body.skills !== undefined) user.skills = body.skills;
    if (body.salaryExpectation !== undefined)
      user.salaryExpectation = body.salaryExpectation;
    if (body.experience !== undefined) user.experience = body.experience;
    if (body.education !== undefined) user.education = body.education;
    // phone is read-only

    await this.userRepo.save(user);

    return this.getWorkerProfile(userId);
  }

  async uploadProfilePhoto(userId: string, file: any) {
    if (!file) throw new BadRequestException('No photo file provided');

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // For development, store as a data URL or use a placeholder.
    // In production, this would upload to S3.
    const profilePhotoUrl = `https://cdn.buildhire.app/workers/${userId}/profile-${Date.now()}.${file.originalname.split('.').pop()}`;

    user.avatarUrl = profilePhotoUrl;
    await this.userRepo.save(user);

    return { profilePhotoUrl };
  }

  // ════════════════════════════════════════════════════
  //  DOCUMENTS
  // ════════════════════════════════════════════════════

  async uploadDocument(userId: string, file: any, type: string) {
    if (!file) throw new BadRequestException('No file provided');
    if (!type) throw new BadRequestException('Document type is required');

    const document = this.documentRepo.create({
      entityType: type,
      entityId: userId,
      objectKey: `documents/${userId}/${type}-${Date.now()}.${file.originalname.split('.').pop()}`,
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      ownerId: userId,
    });

    const saved = await this.documentRepo.save(document);

    return {
      id: saved.id,
      type: saved.entityType,
      name: saved.originalFilename,
      url: `https://cdn.buildhire.app/${saved.objectKey}`,
      verificationStatus: 'pending',
      uploadedAt: saved.createdAt,
    };
  }

  async listDocuments(userId: string) {
    const documents = await this.documentRepo.find({
      where: { ownerId: userId },
      order: { createdAt: 'DESC' },
    });

    return {
      items: documents.map((doc) => ({
        id: doc.id,
        type: doc.entityType,
        name: doc.originalFilename,
        url: `https://cdn.buildhire.app/${doc.objectKey}`,
        verificationStatus: 'pending',
        uploadedAt: doc.createdAt,
      })),
    };
  }

  // ════════════════════════════════════════════════════
  //  JOBS — Save / Apply
  // ════════════════════════════════════════════════════

  async toggleSaveJob(userId: string, jobId: string) {
    const job = await this.jobRepo.findOne({
      where: { id: jobId },
      relations: { company: true },
    });
    if (!job) throw new NotFoundException('Job not found');

    const existing = await this.savedJobRepo.findOne({
      where: { userId, jobId },
    });

    if (existing) {
      await this.savedJobRepo.remove(existing);
    } else {
      await this.savedJobRepo.save(this.savedJobRepo.create({ userId, jobId }));
    }

    const isSavedNow = !existing;
    const hasApplied = await this.applicationRepo.findOne({
      where: { userId, jobId },
    });

    const companyName = job.company?.name ?? 'Unknown';

    return {
      id: job.id,
      title: job.title,
      company: companyName,
      location: job.location,
      dailyPay: job.dailyPay || Number(job.compensation) || 0,
      skills: job.skills ?? [],
      description: job.description ?? '',
      requirements: job.requirements ?? [],
      saved: isSavedNow,
      applied: !!hasApplied,
      projectType: job.projectType ?? 'Full-time',
      experienceLevel: job.experienceLevel ?? 'Any',
    };
  }

  async applyToJob(userId: string, jobId: string, body: Record<string, any>) {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Job not found');

    const existing = await this.applicationRepo.findOne({
      where: { userId, jobId },
    });
    if (existing) {
      throw new ConflictException('You have already applied to this job');
    }

    const application = this.applicationRepo.create({
      jobId,
      userId,
      coverNote: body.coverNote ?? null,
      experience: body.experience ?? null,
      summary: body.summary ?? null,
      availability: body.availability ?? null,
      status: 'pending',
    });

    const saved = await this.applicationRepo.save(application);

    return {
      id: saved.id,
      jobId: saved.jobId,
      status: saved.status,
      coverNote: saved.coverNote ?? '',
    };
  }

  // ════════════════════════════════════════════════════
  //  DASHBOARD
  // ════════════════════════════════════════════════════

  async getDashboard(userId: string) {
    const appliedJobs = await this.applicationRepo.count({
      where: { userId },
    });

    const attendanceRecords = await this.attendanceRepo.find({
      where: { userId },
    });

    const totalMinutes = attendanceRecords.reduce(
      (sum, a) => sum + (a.totalMinutes || 0),
      0,
    );
    const totalHours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;

    const daysAttended = attendanceRecords.filter(
      (a) => a.status === 'present' || a.status === 'half_day',
    ).length;

    const notifications: string[] = [];
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (user) {
      const profileFields = [
        user.fullName,
        user.city,
        user.skills?.length,
        user.salaryExpectation,
        user.avatarUrl,
      ];
      const filled = profileFields.filter(Boolean).length;
      const pct = Math.round((filled / profileFields.length) * 100);
      if (pct < 100) {
        notifications.push(`Your profile is ${pct}% complete`);
      }
    }

    return {
      activeProjects: 0,
      appliedJobs,
      workingHours: `${totalHours}h ${remainingMinutes.toString().padStart(2, '0')}m`,
      attendance: `${daysAttended} days`,
      notifications,
    };
  }

  // ════════════════════════════════════════════════════
  //  CONVERSATIONS (placeholder)
  // ════════════════════════════════════════════════════

  async listConversations(_userId: string) {
    // Messaging is not yet implemented — return empty list.
    return { items: [] };
  }

  async sendMessage(_userId: string, _conversationId: string, _text: string) {
    // Messaging is not yet implemented — acknowledge the message.
    return { sent: true };
  }

  // ════════════════════════════════════════════════════
  //  NOTIFICATIONS (Flutter-compatible shape)
  // ════════════════════════════════════════════════════

  async listNotifications(userId: string) {
    const notifications = await this.notificationRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 50,
    });

    return {
      items: notifications.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        type: n.event,
        time: this.formatRelativeTime(n.createdAt),
        isRead: n.isRead,
      })),
    };
  }

  async markNotificationRead(userId: string, notificationId: string) {
    const notification = await this.notificationRepo.findOne({
      where: { id: notificationId, userId },
    });
    if (!notification) throw new NotFoundException('Notification not found');

    notification.isRead = true;
    await this.notificationRepo.save(notification);

    return {
      id: notification.id,
      title: notification.title,
      body: notification.body,
      type: notification.event,
      time: this.formatRelativeTime(notification.createdAt),
      isRead: true,
    };
  }

  private formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} min ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24)
      return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays} days ago`;
  }
}
