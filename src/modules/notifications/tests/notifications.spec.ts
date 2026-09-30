import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from '../notifications.service.js';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Notification } from '../entities/notification.entity.js';
import { DeviceToken } from '../entities/device-token.entity.js';
import { User } from '../../users/entities/user.entity.js';
import { FirebaseProvider } from '../firebase.provider.js';
import {
  NotificationProcessor,
  NotificationFanoutProcessor,
} from '../notification.processor.js';
import { NotificationMessages } from '../notification-messages.js';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('NotificationsService & Processors', () => {
  let service: NotificationsService;
  let notificationRepo: any;
  let deviceTokenRepo: any;
  let userRepo: any;
  let firebaseProvider: any;
  let notificationProcessor: NotificationProcessor;
  let fanoutProcessor: NotificationFanoutProcessor;

  beforeEach(async () => {
    const createQueryBuilderMock: any = {
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue({ affected: 1 }),
      leftJoinAndSelect: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      take: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      getManyAndCount: vi.fn().mockResolvedValue([
        [
          {
            id: 'notif-1',
            title: 'Test Notif',
            body: 'Message',
            event: 'admin_announcement',
            user: { id: 'user-1', fullName: 'John Doe', role: 'job_seeker' },
          },
        ],
        1,
      ]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        NotificationProcessor,
        NotificationFanoutProcessor,
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
            findOne: vi.fn(),
            findAndCount: vi
              .fn()
              .mockResolvedValue([
                [{ id: 'notif-1', title: 'Test', isRead: false }],
                1,
              ]),
            count: vi.fn().mockResolvedValue(3),
            update: vi.fn().mockResolvedValue({ affected: 1 }),
            createQueryBuilder: vi.fn(() => createQueryBuilderMock),
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
            createQueryBuilder: vi.fn(() => createQueryBuilderMock),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: vi.fn().mockResolvedValue({
              id: 'user-1',
              fullName: 'John Doe',
              isBlocked: false,
            }),
            find: vi.fn().mockResolvedValue([
              { id: 'user-1', fullName: 'John Doe', isBlocked: false },
              { id: 'user-2', fullName: 'Jane Smith', isBlocked: false },
            ]),
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
    notificationProcessor = module.get<NotificationProcessor>(NotificationProcessor);
    fanoutProcessor = module.get<NotificationFanoutProcessor>(NotificationFanoutProcessor);
    notificationRepo = module.get(getRepositoryToken(Notification));
    deviceTokenRepo = module.get(getRepositoryToken(DeviceToken));
    userRepo = module.get(getRepositoryToken(User));
    firebaseProvider = module.get(FirebaseProvider);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(notificationProcessor).toBeDefined();
    expect(fanoutProcessor).toBeDefined();
  });

  // ─── CENTRALIZED NOTIFICATION MESSAGES ─────────────

  describe('NotificationMessages Factory', () => {
    it('should generate P1 seeker applied payload', () => {
      const payload = NotificationMessages.seekerApplied(
        'Site Engineer',
        'Alice',
        'app-1',
        'job-1',
        'company-1',
      );
      expect(payload.type).toBe('application_update');
      expect(payload.title).toBe('New Job Application');
      expect(payload.message).toContain('Alice applied for Site Engineer');
      expect(payload.recipientId).toBe('company-1');
    });

    it('should generate P1 application status payload', () => {
      const payload = NotificationMessages.applicationStatusUpdated(
        'Site Engineer',
        'shortlisted',
        'app-1',
        'job-1',
        'seeker-1',
      );
      expect(payload.type).toBe('application_update');
      expect(payload.title).toBe('Application Shortlisted');
      expect(payload.message).toContain('has been shortlisted');
      expect(payload.recipientId).toBe('seeker-1');
    });

    it('should generate P1 newMessage payload without echoing sender', () => {
      const payload = NotificationMessages.newMessage(
        'Bob',
        'Let us meet at 10 AM',
        'conv-1',
        'seeker-1',
      );
      expect(payload.type).toBe('newMessage');
      expect(payload.title).toBe('New message from Bob');
      expect(payload.message).toBe('Let us meet at 10 AM');
      expect(payload.recipientId).toBe('seeker-1');
    });

    it('should generate P3 attendance summary payload', () => {
      const payload = NotificationMessages.dailyAttendanceSummary(
        'Skyline Tower',
        18,
        20,
        '2026-09-29',
        'contractor-1',
      );
      expect(payload.type).toBe('attendance_event');
      expect(payload.title).toBe('Daily Attendance Summary');
      expect(payload.message).toContain('18/20 workers present');
    });
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

  // ─── IDEMPOTENCY & EXECUTION ──────────────────────

  describe('executeNotificationJob', () => {
    it('should skip duplicate notification if same referenceId exists', async () => {
      notificationRepo.findOne.mockResolvedValue({
        id: 'notif-existing',
        userId: 'user-1',
        event: 'application_update',
        referenceId: 'app-1',
      });

      const result = await service.executeNotificationJob({
        recipientId: 'user-1',
        type: 'application_update',
        title: 'New Job Application',
        message: 'A candidate applied',
        referenceId: 'app-1',
      });

      expect(result?.id).toBe('notif-existing');
      expect(notificationRepo.save).not.toHaveBeenCalled();
      expect(firebaseProvider.sendToDevices).not.toHaveBeenCalled();
    });

    it('should save notification and send FCM push if not duplicate', async () => {
      notificationRepo.findOne.mockResolvedValue(null);
      deviceTokenRepo.find.mockResolvedValue([
        { userId: 'user-1', token: 'fcm-tok-1', isActive: true },
      ]);
      firebaseProvider.sendToDevices.mockResolvedValue([]);

      const result = await service.executeNotificationJob({
        recipientId: 'user-1',
        type: 'application_update',
        title: 'Application Shortlisted',
        message: 'Your application was shortlisted',
        referenceId: 'app-2',
      });

      expect(result?.id).toBe('notif-1');
      expect(notificationRepo.save).toHaveBeenCalled();
      expect(firebaseProvider.sendToDevices).toHaveBeenCalledWith(
        ['fcm-tok-1'],
        'Application Shortlisted',
        'Your application was shortlisted',
        expect.objectContaining({ type: 'application_update' }),
      );
    });

    it('should deactivate invalid tokens when Firebase reports them', async () => {
      notificationRepo.findOne.mockResolvedValue(null);
      deviceTokenRepo.find.mockResolvedValue([
        { userId: 'user-1', token: 'invalid-token', isActive: true },
      ]);
      firebaseProvider.sendToDevices.mockResolvedValue(['invalid-token']);

      await service.executeNotificationJob({
        recipientId: 'user-1',
        type: 'newMessage',
        title: 'New message',
        message: 'Hello there',
      });

      expect(deviceTokenRepo.update).toHaveBeenCalledWith(
        { token: expect.anything() },
        { isActive: false },
      );
    });
  });

  // ─── HIGH LEVEL NOTIFICATION TRIGGERS ─────────────

  describe('High level notification triggers', () => {
    it('should trigger P1 notifySeekerApplied', async () => {
      const spy = vi.spyOn(service, 'dispatchP1').mockResolvedValue();

      await service.notifySeekerApplied(
        'Civil Engineer',
        'Bob',
        'app-10',
        'job-10',
        'company-user-1',
      );

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'application_update',
          recipientId: 'company-user-1',
        }),
        'app-10',
      );
    });

    it('should trigger P1 notifyApplicationStatus', async () => {
      const spy = vi.spyOn(service, 'dispatchP1').mockResolvedValue();

      await service.notifyApplicationStatus(
        'Civil Engineer',
        'accepted',
        'app-10',
        'job-10',
        'seeker-user-1',
      );

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'application_update',
          title: 'Application Accepted',
          recipientId: 'seeker-user-1',
        }),
        'app-10:accepted',
      );
    });

    it('should trigger P1 notifyNewMessage', async () => {
      const spy = vi.spyOn(service, 'dispatchP1').mockResolvedValue();

      await service.notifyNewMessage('Alice', 'Interview Monday', 'conv-1', 'seeker-1');

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'newMessage',
          recipientId: 'seeker-1',
        }),
        'conv-1',
      );
    });

    it('should broadcast P3 admin announcement to all users when userIds omitted', async () => {
      const spy = vi.spyOn(service, 'dispatchFanoutP3').mockResolvedValue();

      const count = await service.notifyAdminAnnouncement('System Update', 'Scheduled maintenance tonight');

      expect(count).toBe(2);
      expect(spy).toHaveBeenCalledWith(
        ['user-1', 'user-2'],
        'admin_announcement',
        'System Update',
        'Scheduled maintenance tonight',
        undefined,
        { event: 'admin_announcement' },
      );
    });
  });

  // ─── ADMIN NOTIFICATION LISTING ───────────────────

  describe('listAdminNotifications', () => {
    it('should list all platform notifications with user relation', async () => {
      const result = await service.listAdminNotifications(1, 20, 'admin_announcement');

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.items[0].user.fullName).toBe('John Doe');
    });
  });
});
