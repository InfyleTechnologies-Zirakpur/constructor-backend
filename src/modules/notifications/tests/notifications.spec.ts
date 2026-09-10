import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from '../notifications.service.js';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Notification } from '../entities/notification.entity.js';
import { DeviceToken } from '../entities/device-token.entity.js';
import { FirebaseProvider } from '../firebase.provider.js';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let notificationRepo: any;
  let deviceTokenRepo: any;
  let firebaseProvider: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getRepositoryToken(Notification),
          useValue: {
            create: vi.fn((data) => ({ id: 'notif-1', ...data })),
            save: vi.fn((data) =>
              Promise.resolve(
                Array.isArray(data)
                  ? data.map((d: any, i: number) => ({
                      id: `notif-${i + 1}`,
                      ...d,
                    }))
                  : { id: 'notif-1', ...data },
              ),
            ),
            findAndCount: vi
              .fn()
              .mockResolvedValue([
                [{ id: 'notif-1', title: 'Test', isRead: false }],
                1,
              ]),
            count: vi.fn().mockResolvedValue(3),
            update: vi.fn().mockResolvedValue({ affected: 1 }),
          },
        },
        {
          provide: getRepositoryToken(DeviceToken),
          useValue: {
            create: vi.fn((data) => ({ id: 'dev-1', ...data })),
            save: vi.fn((data) => Promise.resolve({ id: 'dev-1', ...data })),
            findOne: vi.fn(),
            find: vi.fn().mockResolvedValue([]),
            update: vi.fn().mockResolvedValue({ affected: 1 }),
          },
        },
        {
          provide: FirebaseProvider,
          useValue: {
            sendToDevice: vi.fn().mockResolvedValue(true),
            sendToDevices: vi.fn().mockResolvedValue([]),
            isInitialized: vi.fn().mockReturnValue(true),
          },
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    notificationRepo = module.get(getRepositoryToken(Notification));
    deviceTokenRepo = module.get(getRepositoryToken(DeviceToken));
    firebaseProvider = module.get(FirebaseProvider);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── DEVICE TOKEN MANAGEMENT ──────────────────────

  describe('registerDevice', () => {
    it('should register a new device token', async () => {
      deviceTokenRepo.findOne.mockResolvedValue(null);

      const result = await service.registerDevice('user-1', {
        token: 'fcm-token-abc',
        platform: 'android',
      });

      expect(deviceTokenRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          token: 'fcm-token-abc',
          platform: 'android',
        }),
      );
      expect(result.id).toEqual('dev-1');
    });

    it('should reactivate an existing device token', async () => {
      deviceTokenRepo.findOne.mockResolvedValue({
        id: 'dev-1',
        userId: 'user-1',
        token: 'fcm-token-abc',
        isActive: false,
        platform: 'android',
      });

      const result = await service.registerDevice('user-1', {
        token: 'fcm-token-abc',
      });

      expect(result.isActive).toEqual(true);
    });
  });

  describe('unregisterDevice', () => {
    it('should deactivate a device token', async () => {
      await service.unregisterDevice('user-1', 'fcm-token-abc');

      expect(deviceTokenRepo.update).toHaveBeenCalledWith(
        { userId: 'user-1', token: 'fcm-token-abc' },
        { isActive: false },
      );
    });
  });

  // ─── SEND NOTIFICATIONS ───────────────────────────

  describe('sendNotification', () => {
    it('should create notification records and send FCM push', async () => {
      deviceTokenRepo.find.mockResolvedValue([
        { userId: 'user-1', token: 'tok-1', isActive: true },
      ]);

      const result = await service.sendNotification({
        title: 'New Job Posted',
        body: 'A new construction job has been posted',
        event: 'new_job',
        referenceId: 'job-123',
        userIds: ['user-1'],
      });

      expect(result).toHaveLength(1);
      expect(notificationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          event: 'new_job',
          referenceId: 'job-123',
        }),
      );
      expect(firebaseProvider.sendToDevices).toHaveBeenCalledWith(
        ['tok-1'],
        'New Job Posted',
        'A new construction job has been posted',
        expect.objectContaining({ event: 'new_job' }),
      );
    });

    it('should return empty array if no target users', async () => {
      const result = await service.sendNotification({
        title: 'Test',
        body: 'Test body',
        event: 'project_update',
        userIds: [],
      });

      expect(result).toEqual([]);
    });

    it('should deactivate invalid tokens after FCM send', async () => {
      deviceTokenRepo.find.mockResolvedValue([
        { userId: 'user-1', token: 'bad-tok', isActive: true },
      ]);
      firebaseProvider.sendToDevices.mockResolvedValue(['bad-tok']);

      await service.sendNotification({
        title: 'Test',
        body: 'body',
        event: 'project_update',
        userIds: ['user-1'],
      });

      expect(deviceTokenRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ token: expect.anything() }),
        { isActive: false },
      );
    });
  });

  // ─── LIST / READ ──────────────────────────────────

  describe('listUserNotifications', () => {
    it('should return paginated notifications with unread count', async () => {
      const result = await service.listUserNotifications('user-1', 1, 20);

      expect(result.items).toHaveLength(1);
      expect(result.total).toEqual(1);
      expect(result.unreadCount).toEqual(3);
      expect(result.page).toEqual(1);
    });
  });

  describe('markAsRead', () => {
    it('should mark a single notification as read', async () => {
      await service.markAsRead('notif-1', 'user-1');

      expect(notificationRepo.update).toHaveBeenCalledWith(
        { id: 'notif-1', userId: 'user-1' },
        { isRead: true },
      );
    });
  });

  describe('markAllAsRead', () => {
    it('should mark all notifications as read', async () => {
      await service.markAllAsRead('user-1');

      expect(notificationRepo.update).toHaveBeenCalledWith(
        { userId: 'user-1', isRead: false },
        { isRead: true },
      );
    });
  });
});
