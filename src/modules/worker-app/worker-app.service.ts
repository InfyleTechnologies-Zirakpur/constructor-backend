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
      education: user.education ?? [],
      experience: user.experience ?? [],
      resumes: (user.metadata as any)?.resumes ?? [],
    };
  }

  private pullBase() {
    const pull =
      process.env.BUNNY_PULL_ZONE ??
      process.env.BUNNY_CDN_URL ??
      process.env.BUNNY_CDN_HOSTNAME ??
      'https://construction-site.b-cdn.net';
    const base = pull.startsWith('http') ? pull : `https://${pull}`;
    return base.replace(/\/$/, '');
  }

  private isBunnyConfigured() {
    const z = process.env.BUNNY_STORAGE_ZONE;
    const p =
      process.env.BUNNY_STORAGE_API_KEY ?? process.env.BUNNY_STORAGE_PASSWORD;
    return (
      !!z &&
      !!p &&
      p !== 'your-bunny-storage-password' &&
      p !== 'your-bunny-storage-api-key'
    );
  }

  /** Seeker doc kinds sent by Flutter as `type`. Aadhaar is no longer accepted. */
  private normalizeDocSubtype(raw: unknown): string | null {
    const t = (raw ?? '').toString().trim().toLowerCase();
    if (t === 'aadhaar' || t === 'aadhar') return null;
    if (
      t === 'experience' ||
      t === 'experience_certificate' ||
      t === 'experience-certificate' ||
      t === 'exp_certificate'
    )
      return 'experience';
    if (
      t === 'skill' ||
      t === 'skill_certificate' ||
      t === 'skill-certificate' ||
      t === 'certificate'
    )
      return 'skill';
    if (t === 'resume' || t === 'cv' || t === 'resumecv') return 'resume';
    return t.replace(/[^a-z0-9_-]/g, '') || null;
  }

  private docTypeOf(objectKey: string, fallbackEntityType: string): string {
    const m = (objectKey ?? '').match(
      /worker_doc\/(aadhaar|experience|skill|resume)\//,
    );
    if (m) return m[1];
    if (fallbackEntityType !== 'worker_doc') return fallbackEntityType;
    return 'worker_doc';
  }

  /**
   * PUT bytes to Bunny. Throws when Bunny is configured and the PUT
   * fails — never return a fake success URL in that case.
   * Returns null only when Bunny is NOT configured (local dev).
   */
  private async putToBunny(
    objectKey: string,
    file: any,
  ): Promise<string | null> {
    const cfgZone = process.env.BUNNY_STORAGE_ZONE ?? 'media-construction';
    const cfgPass =
      process.env.BUNNY_STORAGE_API_KEY ?? process.env.BUNNY_STORAGE_PASSWORD;
    const cfgHost =
      process.env.BUNNY_STORAGE_HOSTNAME ?? 'storage.bunnycdn.com';
    if (!this.isBunnyConfigured() || !cfgPass) return null;
    const url = `https://${cfgHost}/${cfgZone}/${objectKey}`;
    const res: any = await (global as any).fetch(url, {
      method: 'PUT',
      headers: { AccessKey: cfgPass, 'Content-Type': file.mimetype },
      body: file.buffer,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.logger.error(
        `Bunny PUT failed (${res.status}) for ${objectKey}: ${body}`,
      );
      throw new BadRequestException(
        `Media upload failed (Bunny ${res.status}). Please retry.`,
      );
    }
    return `${this.pullBase()}/${objectKey}`;
  }

  // ════════════════════════════════════════════════════
  //  PROFILE CRUD
  // ════════════════════════════════════════════════════

  async getWorkerProfile(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // Exclude avatar docs — those are shown via profilePhotoUrl, not as
    // identity documents (experience / skill). Aadhaar docs are removed
    // from the seeker flow entirely — hide any legacy rows too.
    const documents = await this.documentRepo.find({
      where: { ownerId: userId },
      order: { createdAt: 'DESC' },
    });

    const profile = this.buildWorkerProfile(user);
    profile.documents = documents
      .filter(
        (doc) =>
          doc.entityType !== 'user_avatar' &&
          this.docTypeOf(doc.objectKey, doc.entityType) !== 'aadhaar',
      )
      .map((doc) => ({
        id: doc.id,
        type: this.docTypeOf(doc.objectKey, doc.entityType),
        name: doc.originalFilename,
        url: `${this.pullBase()}/${doc.objectKey}`,
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
    if (body.email !== undefined && body.email !== null) {
      const email = String(body.email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new BadRequestException('Invalid email address');
      }
      const existing = await this.userRepo.findOne({ where: { email } });
      if (existing && existing.id !== user.id) {
        throw new ConflictException('Email already registered');
      }
      if (user.email !== email) {
        user.email = email;
        user.emailVerified = false; // must re-verify after change
      }
    }
    if (body.skills !== undefined) {
      const skills = (Array.isArray(body.skills) ? body.skills : [])
        .map((s: any) => String(s ?? '').trim())
        .filter(Boolean);
      // Skills are REQUIRED for job seekers — experience stays optional.
      if (skills.length === 0) {
        throw new BadRequestException('At least one skill is required');
      }
      user.skills = skills;
    }
    if (body.salaryExpectation !== undefined)
      user.salaryExpectation = body.salaryExpectation;
    if (body.experience !== undefined) user.experience = body.experience;
    if (body.education !== undefined) user.education = body.education;
    if (body.resumes !== undefined) {
      user.metadata = { ...(user.metadata || {}), resumes: body.resumes };
    } else if (body.metadata !== undefined) {
      user.metadata = { ...(user.metadata || {}), ...body.metadata };
    }
    // phone is read-only

    // Job seekers must always end up with at least one skill.
    if (
      user.role === 'job_seeker' &&
      (!user.skills || user.skills.length === 0)
    ) {
      throw new BadRequestException('At least one skill is required');
    }

    await this.userRepo.save(user);

    return this.getWorkerProfile(userId);
  }

  async uploadProfilePhoto(userId: string, file: any) {
    if (!file) throw new BadRequestException('No photo file provided');

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // Use global Documents system (Bunny → pull zone) for meaningful folders
    const ext = file.originalname.split('.').pop() || 'jpg';
    const sanitized = file.originalname
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 30);
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const objectKey = `documents/user_avatar/${yyyy}/${mm}/${userId}/${dd}_${sanitized}_${Date.now().toString().slice(-6)}.${ext}`;
    // Upload via Bunny (throws when configured + PUT fails)
    const bunnyUrl = await this.putToBunny(objectKey, file);
    const profilePhotoUrl = bunnyUrl ?? `${this.pullBase()}/${objectKey}`;
    if (!bunnyUrl) {
      this.logger.warn(
        `Bunny not configured — avatar ${objectKey} stored as DB row only`,
      );
    }
    try {
      const doc = this.documentRepo.create({
        entityType: 'user_avatar',
        entityId: userId,
        objectKey,
        originalFilename: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        ownerId: userId,
      } as any);
      await this.documentRepo.save(doc);
    } catch (e: any) {
      this.logger.warn(`Avatar doc-row save failed: ${e?.message}`);
    }
    user.avatarUrl = profilePhotoUrl;
    await this.userRepo.save(user);
    return { profilePhotoUrl };
  }

  // ════════════════════════════════════════════════════
  //  DOCUMENTS
  // ════════════════════════════════════════════════════


  async uploadDocument(userId: string, file: any, type: string) {
    if (!file?.buffer && !file?.size)
      throw new BadRequestException('No file provided');
    if (!type) throw new BadRequestException('Document type is required');

    const subtype = this.normalizeDocSubtype(type);
    if (!subtype) {
      throw new BadRequestException(
        `Unknown document type '${type}'. Allowed: experience, skill`,
      );
    }
    const allowedMime = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (file.mimetype && !allowedMime.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid mime ${file.mimetype}. Allowed ${allowedMime.join(', ')}`,
      );
    }
    if (file.size && file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('File too large, max 10MB');
    }

    const ext = file.originalname.split('.').pop() || 'pdf';
    const base = file.originalname
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .slice(0, 30);
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    // Subtype in path → Bunny dashboard groups docs as
    // documents/worker_doc/aadhaar/... , .../experience/... , .../skill/... , .../resume/...
    const objectKey = `documents/worker_doc/${subtype}/${yyyy}/${mm}/${userId}/${dd}_${base}_${Date.now().toString().slice(-6)}.${ext}`;

    // 1. PUT bytes to Bunny FIRST (throws on failure — no phantom rows).
    const bunnyUrl = await this.putToBunny(objectKey, file);
    const url = bunnyUrl ?? `${this.pullBase()}/${objectKey}`;
    if (!bunnyUrl) {
      this.logger.warn(
        `Bunny not configured — doc ${objectKey} stored as DB row only`,
      );
    }

    const document = this.documentRepo.create({
      entityType: 'worker_doc',
      entityId: userId,
      objectKey,
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      ownerId: userId,
    } as any);

    const savedAny: any = await this.documentRepo.save(document as any);
    const savedDoc: any = Array.isArray(savedAny) ? savedAny[0] : savedAny;
    return {
      id: savedDoc.id,
      type: subtype,
      name: savedDoc.originalFilename,
      url,
      verificationStatus: 'pending',
      uploadedAt: savedDoc.createdAt,
    };
  }

  async listDocuments(userId: string) {
    const documents = await this.documentRepo.find({
      where: { ownerId: userId },
      order: { createdAt: 'DESC' },
    });

    const pull = this.pullBase();
    return {
      items: documents
        .filter(
          (doc) =>
            doc.entityType !== 'user_avatar' &&
            this.docTypeOf(doc.objectKey, doc.entityType) !== 'aadhaar',
        )
        .map((doc) => ({
          id: doc.id,
          type: this.docTypeOf(doc.objectKey, doc.entityType),
          name: doc.originalFilename,
          url: `${pull}/${doc.objectKey}`,
          verificationStatus: 'pending',
          uploadedAt: doc.createdAt,
        })),
    };
  }

  // ════════════════════════════════════════════════════
  //  RESUMES
  // ════════════════════════════════════════════════════

  async listResumes(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const meta = user.metadata || {};
    return { items: Array.isArray(meta.resumes) ? meta.resumes : [] };
  }

  async saveResume(userId: string, resume: Record<string, any>) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const meta = user.metadata || {};
    const resumes = Array.isArray(meta.resumes) ? [...meta.resumes] : [];
    const index = resumes.findIndex((r) => r.id === resume.id);
    const updatedItem = {
      ...resume,
      id: resume.id || Date.now().toString(),
      updatedAt: new Date().toISOString(),
    };
    if (index >= 0) {
      resumes[index] = { ...resumes[index], ...updatedItem };
    } else {
      resumes.unshift(updatedItem);
    }
    user.metadata = { ...meta, resumes };
    await this.userRepo.save(user);
    return updatedItem;
  }

  async deleteResume(userId: string, resumeId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const meta = user.metadata || {};
    const resumes = Array.isArray(meta.resumes) ? [...meta.resumes] : [];
    const filtered = resumes.filter((r) => r.id !== resumeId);
    user.metadata = { ...meta, resumes: filtered };
    await this.userRepo.save(user);
    return { success: true };
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
