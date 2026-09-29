import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Notification } from './entities/notification.entity.js';
import { DeviceToken } from './entities/device-token.entity.js';
import { User } from '../users/entities/user.entity.js';
import { FirebaseProvider } from './firebase.provider.js';
import { RegisterDeviceDto } from './dto/create-notifications.dto.js';
import {
  AdminSendNotificationDto,
  NotificationJobData,
  NotificationFanoutJobData,
} from './dto/notification-job.dto.js';
import {
  NOTIFICATION_QUEUE,
  NOTIFICATION_FANOUT_QUEUE,
} from './notification-queue.constants.js';
import {
  NotificationMessages,
  NotificationPayload,
} from './notification-messages.js';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,

    @InjectRepository(DeviceToken)
    private readonly deviceTokenRepo: Repository<DeviceToken>,

    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    private readonly firebaseProvider: FirebaseProvider,

    @Optional()
    @InjectQueue(NOTIFICATION_QUEUE)
    private readonly notificationQueue?: Queue,

    @Optional()
    @InjectQueue(NOTIFICATION_FANOUT_QUEUE)
    private readonly fanoutQueue?: Queue,
  ) {}

  // ═══════════════════════════════════════════════════
  //  DEVICE TOKEN MANAGEMENT (FCM LIFECYCLE)
  // ═══════════════════════════════════════════════════

  /**
   * Register an FCM device token for a user.
   * - Deactivates token for any previous user (device reassignment).
   * - Reactivates if already registered for this user.
   * - Creates new record if not registered.
   */
  async registerDevice(
    userId: string,
    dto: RegisterDeviceDto,
  ): Promise<DeviceToken> {
    // 1. If this token belongs to another user, deactivate it there
    await this.deviceTokenRepo
      .createQueryBuilder()
      .update(DeviceToken)
      .set({ isActive: false })
      .where('token = :token AND "userId" != :userId', {
        token: dto.token,
        userId,
      })
      .execute();

    // 2. Check if token already registered for this user
    const existing = await this.deviceTokenRepo.findOne({
      where: { userId, token: dto.token },
    });

    if (existing) {
      existing.isActive = true;
      existing.platform = dto.platform ?? existing.platform;
      return this.deviceTokenRepo.save(existing);
    }

    const device = this.deviceTokenRepo.create({
      userId,
      token: dto.token,
      platform: dto.platform ?? 'android',
      isActive: true,
    });

    return this.deviceTokenRepo.save(device);
  }

  /**
   * Unregister a device token on logout.
   */
  async unregisterDevice(userId: string, token: string): Promise<void> {
    await this.deviceTokenRepo.update({ userId, token }, { isActive: false });
  }

  /**
   * Deactivate all device tokens for a user (fallback on logout).
   */
  async deactivateUserTokens(userId: string): Promise<void> {
    await this.deviceTokenRepo.update({ userId }, { isActive: false });
  }

  /**
   * Get active device tokens for a list of user IDs.
   */
  async getActiveTokens(userIds: string[]): Promise<DeviceToken[]> {
    if (userIds.length === 0) return [];
    return this.deviceTokenRepo.find({
      where: { userId: In(userIds), isActive: true },
    });
  }

  // ═══════════════════════════════════════════════════
  //  EXECUTION / WORKER HANDLERS (IDEMPOTENT)
  // ═══════════════════════════════════════════════════

  /**
   * Execute single notification job.
   * Fully idempotent: prevents duplicate records & duplicate pushes on retry.
   */
  async executeNotificationJob(
    data: NotificationJobData,
  ): Promise<Notification | null> {
    if (!data.recipientId) {
      this.logger.warn('executeNotificationJob called without recipientId');
      return null;
    }

    // Idempotency check: check if record already exists for this event + referenceId + user
    if (data.referenceId) {
      const existing = await this.notificationRepo.findOne({
        where: {
          userId: data.recipientId,
          event: data.type,
          referenceId: data.referenceId,
        },
      });
      if (existing) {
        this.logger.log(
          `Notification already exists (${data.type}, ref: ${data.referenceId}, user: ${data.recipientId}). Skipping duplicate.`,
        );
        return existing;
      }
    }

    // Verify recipient exists in database
    const recipient = await this.userRepo.findOne({
      where: { id: data.recipientId },
      select: { id: true, isBlocked: true },
    });
    if (!recipient || recipient.isBlocked) {
      this.logger.warn(
        `Recipient ${data.recipientId} not found or blocked. Skipping notification.`,
      );
      return null;
    }

    // 1. Create and save notification record in database
    const notif = this.notificationRepo.create({
      userId: data.recipientId,
      title: data.title,
      body: data.message,
      event: data.type,
      referenceId: data.referenceId ?? null,
      isRead: false,
      isPushed: false,
    });
    const saved = await this.notificationRepo.save(notif);

    // 2. Fetch active device tokens
    const deviceTokens = await this.getActiveTokens([data.recipientId]);
    if (deviceTokens.length > 0) {
      const tokens = deviceTokens.map((d) => d.token);
      const pushData: Record<string, string> = {
        type: data.type,
        event: data.type,
        title: data.title,
        message: data.message,
        recipientId: data.recipientId,
        referenceId: data.referenceId ?? '',
        createdAt: saved.createdAt?.toISOString() ?? new Date().toISOString(),
        ...(data.data ?? {}),
      };

      const failedTokens = await this.firebaseProvider.sendToDevices(
        tokens,
        data.title,
        data.message,
        pushData,
      );

      // 3. Deactivate any invalid/expired tokens reported by Firebase
      if (failedTokens.length > 0) {
        await this.deviceTokenRepo.update(
          { token: In(failedTokens) },
          { isActive: false },
        );
        this.logger.log(
          `Deactivated ${failedTokens.length} invalid FCM tokens for user ${data.recipientId}`,
        );
      }

      // Mark notification as pushed if at least one token succeeded
      if (tokens.length > failedTokens.length) {
        await this.notificationRepo.update({ id: saved.id }, { isPushed: true });
        saved.isPushed = true;
      }
    }

    return saved;
  }

  /**
   * Execute fanout batch job (P3 batch processing).
   * Batches in chunks of 500 to prevent memory spikes.
   */
  async executeFanoutNotificationJob(
    data: NotificationFanoutJobData,
  ): Promise<number> {
    const recipientIds = [...new Set(data.recipientIds || [])];
    if (recipientIds.length === 0) return 0;

    const chunkSize = 500;
    let totalProcessed = 0;

    for (let i = 0; i < recipientIds.length; i += chunkSize) {
      const chunk = recipientIds.slice(i, i + chunkSize);

      // Verify active users in this chunk
      const activeUsers = await this.userRepo.find({
        where: { id: In(chunk), isBlocked: false },
        select: { id: true },
      });
      const validUserIds = activeUsers.map((u) => u.id);
      if (validUserIds.length === 0) continue;

      // 1. Batch save notification records in DB
      const entities = validUserIds.map((uid) =>
        this.notificationRepo.create({
          userId: uid,
          title: data.title,
          body: data.message,
          event: data.type,
          referenceId: data.referenceId ?? null,
          isRead: false,
          isPushed: false,
        }),
      );
      await this.notificationRepo.save(entities);

      // 2. Fetch active tokens for this batch
      const deviceTokens = await this.getActiveTokens(validUserIds);
      if (deviceTokens.length > 0) {
        const tokens = deviceTokens.map((d) => d.token);
        const pushData: Record<string, string> = {
          type: data.type,
          event: data.type,
          title: data.title,
          message: data.message,
          referenceId: data.referenceId ?? '',
          createdAt: new Date().toISOString(),
          ...(data.data ?? {}),
        };

        const failedTokens = await this.firebaseProvider.sendToDevices(
          tokens,
          data.title,
          data.message,
          pushData,
        );

        if (failedTokens.length > 0) {
          await this.deviceTokenRepo.update(
            { token: In(failedTokens) },
            { isActive: false },
          );
        }
      }

      totalProcessed += validUserIds.length;
    }

    return totalProcessed;
  }

  // ═══════════════════════════════════════════════════
  //  QUEUE DISPATCHERS (P1 RELIABLE / P3 FANOUT)
  // ═══════════════════════════════════════════════════

  /**
   * Dispatch P1 notification to BullMQ queue with 3 retries & exponential backoff.
   * Falls back to direct execution if Redis/Queue is unavailable.
   */
  async dispatchP1(
    payload: NotificationPayload,
    referenceId?: string,
  ): Promise<void> {
    const idempotencyKey = `p1:${payload.type}:${referenceId ?? 'none'}:${payload.recipientId}`;
    const jobData: NotificationJobData = {
      idempotencyKey,
      recipientId: payload.recipientId,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      referenceId,
      data: payload.data,
      priority: 'P1',
    };

    if (this.notificationQueue) {
      try {
        await this.notificationQueue.add('p1-notification', jobData, {
          jobId: idempotencyKey,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000, // 2s, 4s, 8s
          },
          removeOnComplete: true,
          removeOnFail: false,
        });
        return;
      } catch (err: any) {
        this.logger.warn(
          `BullMQ P1 enqueue failed (${err?.message}). Falling back to direct execution.`,
        );
      }
    }

    // Direct fallback
    await this.executeNotificationJob(jobData);
  }

  /**
   * Dispatch P3 notification.
   */
  async dispatchP3(
    payload: NotificationPayload,
    referenceId?: string,
  ): Promise<void> {
    const idempotencyKey = `p3:${payload.type}:${referenceId ?? 'none'}:${payload.recipientId}`;
    const jobData: NotificationJobData = {
      idempotencyKey,
      recipientId: payload.recipientId,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      referenceId,
      data: payload.data,
      priority: 'P3',
    };

    if (this.notificationQueue) {
      try {
        await this.notificationQueue.add('p3-notification', jobData, {
          jobId: idempotencyKey,
          attempts: 2,
          backoff: {
            type: 'exponential',
            delay: 3000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        });
        return;
      } catch (err: any) {
        this.logger.warn(
          `BullMQ P3 enqueue failed (${err?.message}). Falling back to direct execution.`,
        );
      }
    }

    await this.executeNotificationJob(jobData);
  }

  /**
   * Dispatch P3 fanout notification to multiple recipients without blocking APIs.
   */
  async dispatchFanoutP3(
    recipientIds: string[],
    type: string,
    title: string,
    message: string,
    referenceId?: string,
    data?: Record<string, string>,
  ): Promise<void> {
    const uniqueIds = [...new Set(recipientIds)];
    if (uniqueIds.length === 0) return;

    // Small audience: dispatch directly via P3 queue
    if (uniqueIds.length <= 10) {
      await Promise.all(
        uniqueIds.map((uid) =>
          this.dispatchP3(
            {
              type,
              title,
              message,
              data,
              recipientId: uid,
            },
            referenceId,
          ),
        ),
      );
      return;
    }

    const jobData: NotificationFanoutJobData = {
      recipientIds: uniqueIds,
      type,
      title,
      message,
      referenceId,
      data,
      priority: 'P3',
    };

    if (this.fanoutQueue) {
      try {
        await this.fanoutQueue.add('p3-fanout-notification', jobData, {
          attempts: 2,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        });
        return;
      } catch (err: any) {
        this.logger.warn(
          `BullMQ fanout enqueue failed (${err?.message}). Falling back to direct batch execution.`,
        );
      }
    }

    await this.executeFanoutNotificationJob(jobData);
  }

  // ═══════════════════════════════════════════════════
  //  CENTRALIZED HIGH-LEVEL EVENT TRIGGERS
  // ═══════════════════════════════════════════════════

  /**
   * P1: Seeker applied -> notify Company
   */
  async notifySeekerApplied(
    jobTitle: string,
    seekerName: string,
    applicationId: string,
    jobId: string,
    companyUserId: string,
  ): Promise<void> {
    const payload = NotificationMessages.seekerApplied(
      jobTitle,
      seekerName,
      applicationId,
      jobId,
      companyUserId,
    );
    await this.dispatchP1(payload, applicationId);
  }

  /**
   * P1: Application status update -> notify Seeker
   */
  async notifyApplicationStatus(
    jobTitle: string,
    status: string,
    applicationId: string,
    jobId: string,
    seekerUserId: string,
  ): Promise<void> {
    const payload = NotificationMessages.applicationStatusUpdated(
      jobTitle,
      status,
      applicationId,
      jobId,
      seekerUserId,
    );
    await this.dispatchP1(payload, `${applicationId}:${status}`);
  }

  /**
   * P1: New message received -> notify other participant
   */
  async notifyNewMessage(
    senderName: string,
    text: string,
    conversationId: string,
    recipientId: string,
  ): Promise<void> {
    const payload = NotificationMessages.newMessage(
      senderName,
      text,
      conversationId,
      recipientId,
    );
    await this.dispatchP1(payload, conversationId);
  }

  /**
   * P3: New job posted -> notify matching seekers
   */
  async notifyNewJobPosted(
    jobId: string,
    jobTitle: string,
    location: string,
    seekerUserIds: string[],
  ): Promise<void> {
    const msg = NotificationMessages.newJobPosted(
      jobTitle,
      location,
      jobId,
      '',
    );
    await this.dispatchFanoutP3(
      seekerUserIds,
      msg.type,
      msg.title,
      msg.message,
      jobId,
      msg.data,
    );
  }

  /**
   * P3: Contractor assigned to project
   */
  async notifyProjectAssignment(
    projectId: string,
    projectName: string,
    contractorUserId: string,
  ): Promise<void> {
    const payload = NotificationMessages.projectAssignment(
      projectName,
      projectId,
      contractorUserId,
    );
    await this.dispatchP3(payload, projectId);
  }

  /**
   * P3: Site engineer assigned to site
   */
  async notifySiteAssignment(
    siteId: string,
    siteName: string,
    engineerUserId: string,
  ): Promise<void> {
    const payload = NotificationMessages.siteAssignment(
      siteName,
      siteId,
      engineerUserId,
    );
    await this.dispatchP3(payload, siteId);
  }

  /**
   * P3: Daily attendance summary (6 PM batch) -> Contractor
   */
  async notifyAttendanceSummary(
    contractorUserId: string,
    siteName: string,
    presentCount: number,
    totalCount: number,
    date: string,
  ): Promise<void> {
    const payload = NotificationMessages.dailyAttendanceSummary(
      siteName,
      presentCount,
      totalCount,
      date,
      contractorUserId,
    );
    await this.dispatchP3(payload, `${siteName}:${date}`);
  }

  /**
   * P3: Daily report submitted -> Contractor / Admin
   */
  async notifyDailyReportSubmitted(
    reportId: string,
    siteName: string,
    date: string,
    recipientUserIds: string[],
  ): Promise<void> {
    const sample = NotificationMessages.dailyReportSubmitted(
      siteName,
      date,
      reportId,
      '',
    );
    await this.dispatchFanoutP3(
      recipientUserIds,
      sample.type,
      sample.title,
      sample.message,
      reportId,
      sample.data,
    );
  }

  /**
   * P3: Project updated -> Everyone associated
   */
  async notifyProjectUpdate(
    projectId: string,
    projectName: string,
    summary: string,
    recipientUserIds: string[],
  ): Promise<void> {
    const sample = NotificationMessages.projectUpdate(
      projectName,
      summary,
      projectId,
      '',
    );
    await this.dispatchFanoutP3(
      recipientUserIds,
      sample.type,
      sample.title,
      sample.message,
      projectId,
      sample.data,
    );
  }

  /**
   * P3: Admin announcement -> Broadcast or specific users
   */
  async notifyAdminAnnouncement(
    title: string,
    message: string,
    userIds?: string[],
  ): Promise<number> {
    let targets = userIds ?? [];

    // If no userIds provided, broadcast to all active users
    if (targets.length === 0) {
      const allUsers = await this.userRepo.find({
        where: { isBlocked: false },
        select: { id: true },
      });
      targets = allUsers.map((u) => u.id);
    }

    if (targets.length === 0) return 0;

    await this.dispatchFanoutP3(
      targets,
      'admin_announcement',
      title,
      message,
      undefined,
      { event: 'admin_announcement' },
    );

    return targets.length;
  }

  /**
   * Send notification from Admin API.
   */
  async sendAdminNotification(
    dto: AdminSendNotificationDto,
  ): Promise<{ count: number }> {
    let targetUserIds = dto.userIds ?? [];

    // Broadcast if admin announcement and userIds empty
    if (
      (!dto.userIds || dto.userIds.length === 0) &&
      (dto.event === 'admin_announcement' || !dto.event)
    ) {
      const allUsers = await this.userRepo.find({
        where: { isBlocked: false },
        select: { id: true },
      });
      targetUserIds = allUsers.map((u) => u.id);
    }

    if (targetUserIds.length === 0) {
      return { count: 0 };
    }

    const event = dto.event || 'admin_announcement';
    await this.dispatchFanoutP3(
      targetUserIds,
      event,
      dto.title,
      dto.body,
      dto.referenceId,
      { event },
    );

    return { count: targetUserIds.length };
  }

  // ═══════════════════════════════════════════════════
  //  LIST / READ NOTIFICATIONS
  // ═══════════════════════════════════════════════════

  /**
   * Admin view: list all notifications across platform from real DB data with user relation.
   */
  async listAdminNotifications(
    page: number = 1,
    limit: number = 20,
    event?: string,
    userId?: string,
    search?: string,
  ) {
    const query = this.notificationRepo
      .createQueryBuilder('notification')
      .leftJoinAndSelect('notification.user', 'user')
      .orderBy('notification.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (event) {
      query.andWhere('notification.event = :event', { event });
    }

    if (userId) {
      query.andWhere('notification.userId = :userId', { userId });
    }

    if (search) {
      query.andWhere(
        '(notification.title ILIKE :search OR notification.body ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [items, total] = await query.getManyAndCount();
    const unreadCount = await this.notificationRepo.count({
      where: { isRead: false },
    });

    return { items, total, unreadCount, page, limit };
  }

  /**
   * List notifications for a single user with pagination.
   */
  async listUserNotifications(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const [items, total] = await this.notificationRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const unreadCount = await this.notificationRepo.count({
      where: { userId, isRead: false },
    });

    return { items, total, unreadCount, page, limit };
  }

  /**
   * Mark a notification as read.
   */
  async markAsRead(notificationId: string, userId?: string): Promise<void> {
    const where: any = { id: notificationId };
    if (userId) {
      where.userId = userId;
    }
    await this.notificationRepo.update(where, { isRead: true });
  }

  /**
   * Mark all notifications as read for a user.
   */
  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepo.update(
      { userId, isRead: false },
      { isRead: true },
    );
  }
}
