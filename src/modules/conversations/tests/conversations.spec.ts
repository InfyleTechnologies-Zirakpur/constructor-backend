import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConversationsService } from '../conversations.service.js';
import { Conversation } from '../entities/conversation.entity.js';
import { Message } from '../entities/message.entity.js';
import { User } from '../../users/entities/user.entity.js';
import { Job } from '../../jobs/entities/job.entity.js';
import { Application } from '../../applications/entities/application.entity.js';
import { NotificationsService } from '../../notifications/notifications.service.js';

describe('ConversationsService', () => {
  let service: ConversationsService;
  let convRepo: Repository<Conversation>;
  let msgRepo: Repository<Message>;
  let userRepo: Repository<User>;
  let jobRepo: Repository<Job>;
  let appRepo: Repository<Application>;
  let notificationsService: NotificationsService;

  const companyUserId = 'company-user-uuid';
  const seekerUserId = 'seeker-user-uuid';
  const otherUserId = 'other-user-uuid';
  const jobId = 'job-uuid';
  const applicationId = 'app-uuid';
  const convId = 'conv-uuid';

  const mockConversation: Partial<Conversation> = {
    id: convId,
    companyId: companyUserId,
    seekerId: seekerUserId,
    jobId,
    applicationId,
    lastMessage: null as any,
    lastMessageAt: null as any,
    unreadCountCompany: 0,
    unreadCountSeeker: 0,
    application: {
      id: applicationId,
      status: 'shortlisted',
    } as any,
  };

  const mockNotificationsService = {
    notifyNewMessage: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationsService,
        {
          provide: getRepositoryToken(Conversation),
          useValue: {
            findOne: vi.fn(),
            find: vi.fn(),
            create: vi.fn((entity) => ({ ...entity, id: convId })),
            save: vi.fn((entity) => Promise.resolve(entity)),
          },
        },
        {
          provide: getRepositoryToken(Message),
          useValue: {
            findOne: vi.fn(),
            find: vi.fn(),
            count: vi.fn(),
            create: vi.fn((entity) => ({
              ...entity,
              id: 'msg-uuid-' + Math.random().toString(36).substring(7),
            })),
            save: vi.fn((entity) =>
              Promise.resolve({ ...entity, createdAt: new Date() }),
            ),
            update: vi.fn().mockResolvedValue({ affected: 1 }),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: vi.fn(),
          },
        },
        {
          provide: getRepositoryToken(Job),
          useValue: {
            findOne: vi.fn(),
          },
        },
        {
          provide: getRepositoryToken(Application),
          useValue: {
            findOne: vi.fn(),
          },
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
      ],
    }).compile();

    service = module.get<ConversationsService>(ConversationsService);
    convRepo = module.get(getRepositoryToken(Conversation));
    msgRepo = module.get(getRepositoryToken(Message));
    userRepo = module.get(getRepositoryToken(User));
    jobRepo = module.get(getRepositoryToken(Job));
    appRepo = module.get(getRepositoryToken(Application));
    notificationsService = module.get(NotificationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ═══════════════════════════════════════════════════════════════
  //  1. CANDIDATE FIRST MESSAGE RESTRICTION
  // ═══════════════════════════════════════════════════════════════

  describe('sendMessage - Candidate First Message Restriction', () => {
    it('should NOT allow a candidate to send the first message if company has not sent any message', async () => {
      vi.spyOn(convRepo, 'findOne').mockResolvedValue({
        ...mockConversation,
      } as Conversation);

      // Company has sent 0 messages
      vi.spyOn(msgRepo, 'count').mockResolvedValue(0);

      await expect(
        service.sendMessage(convId, seekerUserId, 'Hi, I applied for the job!'),
      ).rejects.toThrow(
        new ForbiddenException(
          'The candidate cannot send the first message. The company must initiate the conversation.',
        ),
      );

      // Message should NOT be saved in DB
      expect(msgRepo.save).not.toHaveBeenCalled();
      // Notification should NOT be triggered
      expect(notificationsService.notifyNewMessage).not.toHaveBeenCalled();
    });

    it('should allow candidate to reply once company has sent at least one message', async () => {
      vi.spyOn(convRepo, 'findOne').mockResolvedValue({
        ...mockConversation,
      } as Conversation);

      // Company has sent 1 message
      vi.spyOn(msgRepo, 'count').mockResolvedValue(1);
      vi.spyOn(msgRepo, 'findOne').mockResolvedValue(null); // No recent duplicate
      vi.spyOn(userRepo, 'findOne').mockResolvedValue({
        id: seekerUserId,
        fullName: 'Candidate John',
      } as User);

      const result = await service.sendMessage(
        convId,
        seekerUserId,
        'Thank you! I am available on Monday at 10 AM.',
      );

      expect(result).toBeDefined();
      expect(result.text).toBe('Thank you! I am available on Monday at 10 AM.');
      expect(result.senderId).toBe(seekerUserId);
      expect(result.conversationId).toBe(convId);
      expect(msgRepo.save).toHaveBeenCalled();
      expect(convRepo.save).toHaveBeenCalled();

      // Notification sent to company
      expect(notificationsService.notifyNewMessage).toHaveBeenCalledWith(
        'Candidate John',
        'Thank you! I am available on Monday at 10 AM.',
        convId,
        companyUserId,
        result.id,
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  2. COMPANY FIRST MESSAGE & APPLICATION STATUS ENFORCEMENT
  // ═══════════════════════════════════════════════════════════════

  describe('sendMessage - Company Status Enforcement', () => {
    it('should NOT allow company to initiate conversation if application is still pending', async () => {
      vi.spyOn(convRepo, 'findOne').mockResolvedValue({
        ...mockConversation,
        application: {
          id: applicationId,
          status: 'pending',
        } as Application,
      } as Conversation);

      vi.spyOn(msgRepo, 'count').mockResolvedValue(0);

      await expect(
        service.sendMessage(convId, companyUserId, 'Hello candidate'),
      ).rejects.toThrow(
        new ForbiddenException(
          'The company can only send the first message after the application is accepted, rejected, or shortlisted.',
        ),
      );

      expect(msgRepo.save).not.toHaveBeenCalled();
      expect(notificationsService.notifyNewMessage).not.toHaveBeenCalled();
    });

    it('should NOT allow company to initiate conversation if application is reviewed (not shortlisted/accepted/rejected)', async () => {
      vi.spyOn(convRepo, 'findOne').mockResolvedValue({
        ...mockConversation,
        application: {
          id: applicationId,
          status: 'reviewed',
        } as Application,
      } as Conversation);

      vi.spyOn(msgRepo, 'count').mockResolvedValue(0);

      await expect(
        service.sendMessage(convId, companyUserId, 'Hello candidate'),
      ).rejects.toThrow(
        new ForbiddenException(
          'The company can only send the first message after the application is accepted, rejected, or shortlisted.',
        ),
      );
    });

    it('should allow company to send first message when application is shortlisted', async () => {
      vi.spyOn(convRepo, 'findOne').mockResolvedValue({
        ...mockConversation,
        application: {
          id: applicationId,
          status: 'shortlisted',
        } as Application,
      } as Conversation);

      vi.spyOn(msgRepo, 'count').mockResolvedValue(0);
      vi.spyOn(msgRepo, 'findOne').mockResolvedValue(null);
      vi.spyOn(userRepo, 'findOne').mockResolvedValue({
        id: companyUserId,
        fullName: 'Acme Corp',
      } as User);

      const result = await service.sendMessage(
        convId,
        companyUserId,
        'Congratulations! You have been shortlisted for an interview.',
      );

      expect(result).toBeDefined();
      expect(result.senderId).toBe(companyUserId);
      expect(result.conversationId).toBe(convId);
      expect(result.text).toBe(
        'Congratulations! You have been shortlisted for an interview.',
      );
      expect(msgRepo.save).toHaveBeenCalled();
      expect(convRepo.save).toHaveBeenCalled();

      // Notification sent to candidate
      expect(notificationsService.notifyNewMessage).toHaveBeenCalledWith(
        'Acme Corp',
        'Congratulations! You have been shortlisted for an interview.',
        convId,
        seekerUserId,
        result.id,
      );
    });

    it('should allow company to send first message when application is accepted', async () => {
      vi.spyOn(convRepo, 'findOne').mockResolvedValue({
        ...mockConversation,
        application: {
          id: applicationId,
          status: 'accepted',
        } as Application,
      } as Conversation);

      vi.spyOn(msgRepo, 'count').mockResolvedValue(0);
      vi.spyOn(msgRepo, 'findOne').mockResolvedValue(null);
      vi.spyOn(userRepo, 'findOne').mockResolvedValue({
        id: companyUserId,
        fullName: 'Acme Corp',
      } as User);

      const result = await service.sendMessage(
        convId,
        companyUserId,
        'We are pleased to offer you the position.',
      );

      expect(result).toBeDefined();
      expect(result.text).toBe('We are pleased to offer you the position.');
      expect(msgRepo.save).toHaveBeenCalled();
    });

    it('should allow company to send first message when application is rejected', async () => {
      vi.spyOn(convRepo, 'findOne').mockResolvedValue({
        ...mockConversation,
        application: {
          id: applicationId,
          status: 'rejected',
        } as Application,
      } as Conversation);

      vi.spyOn(msgRepo, 'count').mockResolvedValue(0);
      vi.spyOn(msgRepo, 'findOne').mockResolvedValue(null);
      vi.spyOn(userRepo, 'findOne').mockResolvedValue({
        id: companyUserId,
        fullName: 'Acme Corp',
      } as User);

      const result = await service.sendMessage(
        convId,
        companyUserId,
        'Thank you for your time. Unfortunately we have decided to pursue other candidates.',
      );

      expect(result).toBeDefined();
      expect(result.text).toContain('Unfortunately');
      expect(msgRepo.save).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  3. CONTINUED CHAT FLOW
  // ═══════════════════════════════════════════════════════════════

  describe('sendMessage - Continued Chat Flow', () => {
    it('should allow both candidate and company to continue conversation normally', async () => {
      vi.spyOn(convRepo, 'findOne').mockResolvedValue({
        ...mockConversation,
      } as Conversation);
      vi.spyOn(msgRepo, 'count').mockResolvedValue(3); // Already in continued conversation
      vi.spyOn(msgRepo, 'findOne').mockResolvedValue(null);
      vi.spyOn(userRepo, 'findOne').mockResolvedValue({
        id: companyUserId,
        fullName: 'Acme HR',
      } as User);

      const companyMsg = await service.sendMessage(
        convId,
        companyUserId,
        'Great, see you on Monday!',
      );

      expect(companyMsg).toBeDefined();
      expect(companyMsg.text).toBe('Great, see you on Monday!');
      expect(notificationsService.notifyNewMessage).toHaveBeenCalledWith(
        'Acme HR',
        'Great, see you on Monday!',
        convId,
        seekerUserId,
        companyMsg.id,
      );

      // Candidate replies back
      vi.spyOn(userRepo, 'findOne').mockResolvedValue({
        id: seekerUserId,
        fullName: 'John Seeker',
      } as User);

      const candidateMsg = await service.sendMessage(
        convId,
        seekerUserId,
        'Should I bring my certificates as well?',
      );

      expect(candidateMsg).toBeDefined();
      expect(candidateMsg.text).toBe('Should I bring my certificates as well?');
      expect(notificationsService.notifyNewMessage).toHaveBeenCalledWith(
        'John Seeker',
        'Should I bring my certificates as well?',
        convId,
        companyUserId,
        candidateMsg.id,
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  4. VALIDATION & SECURITY
  // ═══════════════════════════════════════════════════════════════

  describe('sendMessage - Validation & Security', () => {
    it('should reject empty or whitespace-only messages', async () => {
      await expect(
        service.sendMessage(convId, companyUserId, '   '),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject non-existent conversation with NotFoundException', async () => {
      vi.spyOn(convRepo, 'findOne').mockResolvedValue(null);

      await expect(
        service.sendMessage('invalid-conv', companyUserId, 'Hello'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject users who are not part of the conversation', async () => {
      vi.spyOn(convRepo, 'findOne').mockResolvedValue({
        ...mockConversation,
      } as Conversation);
      vi.spyOn(userRepo, 'findOne').mockResolvedValue({
        id: otherUserId,
        role: 'job_seeker',
      } as User);

      await expect(
        service.sendMessage(convId, otherUserId, 'Hello eavesdropper'),
      ).rejects.toThrow(
        new ForbiddenException('Not part of this conversation'),
      );
    });

    it('should prevent duplicate messages within 5 seconds and return existing message', async () => {
      vi.spyOn(convRepo, 'findOne').mockResolvedValue({
        ...mockConversation,
      } as Conversation);
      vi.spyOn(msgRepo, 'count').mockResolvedValue(2);

      const existingRecentMsg: Message = {
        id: 'msg-existing-uuid',
        conversationId: convId,
        senderId: companyUserId,
        text: 'Duplicate test message',
        isRead: false,
        createdAt: new Date(),
        conversation: null as any,
        sender: null as any,
      };

      vi.spyOn(msgRepo, 'findOne').mockResolvedValue(existingRecentMsg);

      const result = await service.sendMessage(
        convId,
        companyUserId,
        'Duplicate test message',
      );

      expect(result.id).toBe('msg-existing-uuid');
      // Should NOT save another row to DB
      expect(msgRepo.save).not.toHaveBeenCalled();
      // Should NOT send duplicate notification
      expect(notificationsService.notifyNewMessage).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  5. LISTING & READING
  // ═══════════════════════════════════════════════════════════════

  describe('listMessages and markRead', () => {
    it('should list messages with sender info ordered by createdAt ASC', async () => {
      vi.spyOn(convRepo, 'findOne').mockResolvedValue({
        ...mockConversation,
      } as Conversation);

      const mockMessages = [
        {
          id: 'msg-1',
          conversationId: convId,
          senderId: companyUserId,
          text: 'First message',
          isRead: true,
          createdAt: new Date('2026-09-30T10:00:00Z'),
          sender: {
            id: companyUserId,
            fullName: 'Company',
            avatarUrl: null,
            role: 'company',
          },
        },
        {
          id: 'msg-2',
          conversationId: convId,
          senderId: seekerUserId,
          text: 'Reply message',
          isRead: false,
          createdAt: new Date('2026-09-30T10:05:00Z'),
          sender: {
            id: seekerUserId,
            fullName: 'Seeker',
            avatarUrl: null,
            role: 'job_seeker',
          },
        },
      ];

      vi.spyOn(msgRepo, 'find').mockResolvedValue(mockMessages as any);

      const result = await service.listMessages(
        convId,
        seekerUserId,
        'job_seeker',
      );
      expect(result).toHaveLength(2);
      expect(result[0].text).toBe('First message');
      expect(result[1].text).toBe('Reply message');
    });

    it('should mark unread messages as read and reset unread counter', async () => {
      const convWithUnread = {
        ...mockConversation,
        unreadCountSeeker: 3,
      } as Conversation;
      vi.spyOn(convRepo, 'findOne').mockResolvedValue(convWithUnread);

      const result = await service.markRead(convId, seekerUserId, 'job_seeker');
      expect(result.updated).toBe(true);
      expect(convWithUnread.unreadCountSeeker).toBe(0);
      expect(convRepo.save).toHaveBeenCalledWith(convWithUnread);
      expect(msgRepo.update).toHaveBeenCalledWith(
        { conversationId: convId, isRead: false },
        { isRead: true },
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════
  //  6. FIND OR CREATE
  // ═══════════════════════════════════════════════════════════════

  describe('findOrCreate', () => {
    it('should return existing conversation if found and patch missing applicationId', async () => {
      const existingConv = {
        ...mockConversation,
        applicationId: null as any,
      } as Conversation;
      vi.spyOn(convRepo, 'findOne').mockResolvedValue(existingConv);

      const result = await service.findOrCreate(
        companyUserId,
        seekerUserId,
        jobId,
        applicationId,
      );

      expect(result.id).toBe(convId);
      expect(existingConv.applicationId).toBe(applicationId);
      expect(convRepo.save).toHaveBeenCalledWith(existingConv);
    });

    it('should create new conversation after verifying all foreign entities exist', async () => {
      vi.spyOn(convRepo, 'findOne').mockResolvedValue(null);
      vi.spyOn(userRepo, 'findOne')
        .mockResolvedValueOnce({ id: companyUserId } as User)
        .mockResolvedValueOnce({ id: seekerUserId } as User);
      vi.spyOn(jobRepo, 'findOne').mockResolvedValue({ id: jobId } as Job);
      vi.spyOn(appRepo, 'findOne').mockResolvedValue({
        id: applicationId,
      } as Application);

      const result = await service.findOrCreate(
        companyUserId,
        seekerUserId,
        jobId,
        applicationId,
      );

      expect(result).toBeDefined();
      expect(convRepo.create).toHaveBeenCalledWith({
        companyId: companyUserId,
        seekerId: seekerUserId,
        jobId,
        applicationId,
      });
      expect(convRepo.save).toHaveBeenCalled();
    });
  });
});
