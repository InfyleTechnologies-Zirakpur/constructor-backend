import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Notification } from './entities/notification.entity.js';
import { DeviceToken } from './entities/device-token.entity.js';
import { FirebaseProvider } from './firebase.provider.js';
import { RegisterDeviceDto } from './dto/create-notifications.dto.js';
import { SendNotificationDto } from './dto/update-notifications.dto.js';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,

    @InjectRepository(DeviceToken)
    private readonly deviceTokenRepo: Repository<DeviceToken>,

    private readonly firebaseProvider: FirebaseProvider,
  ) {}

  // ═══════════════════════════════════════════════════
  //  DEVICE TOKEN MANAGEMENT
  // ═══════════════════════════════════════════════════

  /**
   * Register an FCM device token for a user.
   * If the token already exists for this user, reactivate it.
   */
  async registerDevice(
    userId: string,
    dto: RegisterDeviceDto,
  ): Promise<DeviceToken> {
    // Check if token already registered for this user
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
    });

    return this.deviceTokenRepo.save(device);
  }

  /**
   * Unregister a device token (e.g. on logout).
   */
  async unregisterDevice(userId: string, token: string): Promise<void> {
    await this.deviceTokenRepo.update({ userId, token }, { isActive: false });
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
  //  SEND NOTIFICATIONS
  // ═══════════════════════════════════════════════════

  /**
   * Send a notification to specific users (or all users for announcements).
   * 1. Creates notification records in the database.
   * 2. Sends FCM push to all active device tokens.
   * 3. Cleans up invalid tokens.
   */
  async sendNotification(dto: SendNotificationDto): Promise<Notification[]> {
    let targetUserIds = dto.userIds ?? [];

    // For admin announcements without specific targets, broadcast to all active tokens
    if (dto.event === 'admin_announcement' && targetUserIds.length === 0) {
      const allTokens = await this.deviceTokenRepo.find({
        where: { isActive: true },
        select: { userId: true },
      });
      targetUserIds = [...new Set(allTokens.map((t) => t.userId))];
    }

    if (targetUserIds.length === 0) {
      this.logger.warn('No target users for notification');
      return [];
    }

    // 1. Create notification records
    const notifications = targetUserIds.map((uid) =>
      this.notificationRepo.create({
        userId: uid,
        title: dto.title,
        body: dto.body,
        event: dto.event,
        referenceId: dto.referenceId ?? null,
        isRead: false,
        isPushed: false,
      }),
    );

    const savedNotifications = await this.notificationRepo.save(notifications);

    // 2. Send FCM push
    const deviceTokens = await this.getActiveTokens(targetUserIds);
    if (deviceTokens.length > 0) {
      const tokens = deviceTokens.map((d) => d.token);
      const data: Record<string, string> = {
        event: dto.event,
        ...(dto.referenceId ? { referenceId: dto.referenceId } : {}),
      };

      const failedTokens = await this.firebaseProvider.sendToDevices(
        tokens,
        dto.title,
        dto.body,
        data,
      );

      // 3. Deactivate invalid tokens
      if (failedTokens.length > 0) {
        await this.deviceTokenRepo.update(
          { token: In(failedTokens) },
          { isActive: false },
        );
        this.logger.log(
          `Deactivated ${failedTokens.length} invalid FCM tokens`,
        );
      }

      // Mark notifications as pushed
      const successUserIds = deviceTokens
        .filter((d) => !failedTokens.includes(d.token))
        .map((d) => d.userId);

      if (successUserIds.length > 0) {
        await this.notificationRepo.update(
          { userId: In(successUserIds), isPushed: false },
          { isPushed: true },
        );
      }
    }

    return savedNotifications;
  }

  /**
   * Convenience method for internal services to trigger a notification.
   */
  async notify(
    userIds: string[],
    event: string,
    title: string,
    body: string,
    referenceId?: string,
  ): Promise<void> {
    await this.sendNotification({
      userIds,
      event,
      title,
      body,
      referenceId,
    });
  }

  // ═══════════════════════════════════════════════════
  //  LIST / READ NOTIFICATIONS
  // ═══════════════════════════════════════════════════

  /**
   * List notifications for a user with pagination.
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
  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await this.notificationRepo.update(
      { id: notificationId, userId },
      { isRead: true },
    );
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
