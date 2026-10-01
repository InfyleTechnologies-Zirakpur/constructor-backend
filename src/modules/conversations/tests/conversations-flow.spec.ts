import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ForbiddenException } from '@nestjs/common';
import { ConversationsService } from '../conversations.service.js';
import { ApplicationsService } from '../../applications/applications.service.js';
import { Conversation } from '../entities/conversation.entity.js';
import { Message } from '../entities/message.entity.js';
import { Application } from '../../applications/entities/application.entity.js';
import { Job } from '../../jobs/entities/job.entity.js';
import { Company } from '../../companies/entities/company.entity.js';
import { User } from '../../users/entities/user.entity.js';
import { NotificationsService } from '../../notifications/notifications.service.js';

describe('Complete Message Flow End-to-End Test', () => {
  let conversationsService: ConversationsService;
  let applicationsService: ApplicationsService;

  // In-memory DB storage simulating PostgreSQL tables
  const db = {
    users: new Map<string, User>(),
    jobs: new Map<string, Job>(),
    companies: new Map<string, Company>(),
    applications: new Map<string, Application>(),
    conversations: new Map<string, Conversation>(),
    messages: [] as Message[],
  };

  const companyUserId = 'company-owner-user-id';
  const candidateUserId = 'candidate-seeker-user-id';
  const companyProfileId = 'company-profile-id';
  const testJobId = 'job-published-id';

  const mockNotificationsService = {
    notifySeekerApplied: vi.fn().mockResolvedValue(undefined),
    notifyApplicationStatus: vi.fn().mockResolvedValue(undefined),
    notifyNewMessage: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Reset in-memory DB
    db.users.clear();
    db.jobs.clear();
    db.companies.clear();
    db.applications.clear();
    db.conversations.clear();
    db.messages.length = 0;

    // Seed initial users
    const companyUser = {
      id: companyUserId,
      fullName: 'Construction Boss',
      role: 'company',
      avatarUrl: null,
    } as User;
    db.users.set(companyUserId, companyUser);

    const candidateUser = {
      id: candidateUserId,
      fullName: 'Skilled Welder',
      role: 'job_seeker',
      avatarUrl: null,
    } as User;
    db.users.set(candidateUserId, candidateUser);

    const companyEntity = {
      id: companyProfileId,
      userId: companyUserId,
      name: 'BuildTech Ltd',
    } as Company;
    db.companies.set(companyProfileId, companyEntity);

    const jobEntity = {
      id: testJobId,
      title: 'Structural Welder',
      status: 'published',
      companyId: companyProfileId,
      company: companyEntity,
    } as Job;
    db.jobs.set(testJobId, jobEntity);

    // Build NestJS testing module with in-memory backed repositories
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationsService,
        ApplicationsService,
        {
          provide: getRepositoryToken(Conversation),
          useValue: {
            findOne: vi.fn(async ({ where }) => {
              for (const conv of db.conversations.values()) {
                if (where.id && conv.id === where.id) {
                  return {
                    ...conv,
                    application: conv.applicationId
                      ? db.applications.get(conv.applicationId)
                      : null,
                  };
                }
                if (
                  where.companyId === conv.companyId &&
                  where.seekerId === conv.seekerId &&
                  where.jobId === conv.jobId
                ) {
                  return {
                    ...conv,
                    application: conv.applicationId
                      ? db.applications.get(conv.applicationId)
                      : null,
                  };
                }
              }
              return null;
            }),
            find: vi.fn(async () => Array.from(db.conversations.values())),
            create: vi.fn((dto) => {
              const conv = {
                id: 'conv-' + (db.conversations.size + 1),
                unreadCountCompany: 0,
                unreadCountSeeker: 0,
                lastMessage: null,
                lastMessageAt: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                ...dto,
              };
              return conv;
            }),
            save: vi.fn(async (conv) => {
              db.conversations.set(conv.id, { ...conv });
              return conv;
            }),
          },
        },
        {
          provide: getRepositoryToken(Message),
          useValue: {
            findOne: vi.fn(async ({ where }) => {
              const match = [...db.messages].reverse().find((m) => {
                if (
                  where.conversationId &&
                  m.conversationId !== where.conversationId
                )
                  return false;
                if (where.senderId && m.senderId !== where.senderId)
                  return false;
                if (where.text && m.text !== where.text) return false;
                return true;
              });
              return match ?? null;
            }),
            count: vi.fn(async ({ where }) => {
              return db.messages.filter((m) => {
                if (
                  where.conversationId &&
                  m.conversationId !== where.conversationId
                )
                  return false;
                if (where.senderId && m.senderId !== where.senderId)
                  return false;
                return true;
              }).length;
            }),
            find: vi.fn(async ({ where }) => {
              return db.messages
                .filter((m) => m.conversationId === where.conversationId)
                .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
            }),
            create: vi.fn((dto) => {
              return {
                id: 'msg-' + (db.messages.length + 1),
                createdAt: new Date(),
                ...dto,
              };
            }),
            save: vi.fn(async (msg) => {
              const saved = { ...msg };
              db.messages.push(saved);
              return saved;
            }),
            update: vi.fn(async ({ conversationId }, { isRead }) => {
              db.messages.forEach((m) => {
                if (m.conversationId === conversationId) m.isRead = isRead;
              });
              return { affected: 1 };
            }),
          },
        },
        {
          provide: getRepositoryToken(Application),
          useValue: {
            findOne: vi.fn(async ({ where }) => {
              if (where.id) {
                const app = db.applications.get(where.id);
                if (!app) return null;
                return {
                  ...app,
                  job: db.jobs.get(app.jobId),
                  user: db.users.get(app.userId),
                };
              }
              if (where.jobId && where.userId) {
                for (const app of db.applications.values()) {
                  if (app.jobId === where.jobId && app.userId === where.userId)
                    return app;
                }
              }
              return null;
            }),
            create: vi.fn((dto) => {
              return {
                id: 'app-' + (db.applications.size + 1),
                createdAt: new Date(),
                ...dto,
              };
            }),
            save: vi.fn(async (app) => {
              db.applications.set(app.id, { ...app });
              return app;
            }),
          },
        },
        {
          provide: getRepositoryToken(Job),
          useValue: {
            findOne: vi.fn(async ({ where }) => {
              const job = db.jobs.get(where.id);
              if (!job) return null;
              return { ...job, company: db.companies.get(job.companyId) };
            }),
          },
        },
        {
          provide: getRepositoryToken(Company),
          useValue: {
            findOne: vi.fn(async ({ where }) => {
              if (where.userId) {
                for (const c of db.companies.values()) {
                  if (c.userId === where.userId) return c;
                }
              }
              if (where.id) return db.companies.get(where.id);
              return null;
            }),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: vi.fn(async ({ where }) => db.users.get(where.id) ?? null),
          },
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
      ],
    }).compile();

    conversationsService =
      module.get<ConversationsService>(ConversationsService);
    applicationsService = module.get<ApplicationsService>(ApplicationsService);
  });

  it('Complete Flow: Application -> Company First Message -> Candidate Reply -> Continued Chat -> Notification', async () => {
    // ══════════════════════════════════════════════════════════
    // STEP 1: Candidate applies for published job
    // ══════════════════════════════════════════════════════════
    const application = await applicationsService.apply(
      testJobId,
      candidateUserId,
      {
        coverNote: 'Experienced welder ready to work immediately.',
        experience: '5 years',
        availability: 'immediate',
      },
    );

    expect(application).toBeDefined();
    expect(application.status).toBe('pending');
    expect(db.applications.get(application.id)).toBeDefined();
    // Verify NO conversation is created upon simple application submission
    expect(db.conversations.size).toBe(0);

    // ══════════════════════════════════════════════════════════
    // STEP 2: Candidate CANNOT send the first message
    // ══════════════════════════════════════════════════════════
    // If a conversation were established, seeker cannot send first message
    const initialConv = await conversationsService.findOrCreate(
      companyUserId,
      candidateUserId,
      testJobId,
      application.id,
    );
    expect(initialConv).toBeDefined();
    expect(db.conversations.size).toBe(1);

    // Candidate attempts to send first message -> MUST BE REJECTED
    await expect(
      conversationsService.sendMessage(
        initialConv.id,
        candidateUserId,
        'Hi, did you review my application?',
      ),
    ).rejects.toThrow(ForbiddenException);

    // Database check: 0 messages stored
    expect(db.messages).toHaveLength(0);

    // ══════════════════════════════════════════════════════════
    // STEP 3: Company CANNOT initiate message while application is pending
    // ══════════════════════════════════════════════════════════
    await expect(
      conversationsService.sendMessage(
        initialConv.id,
        companyUserId,
        'Hello from company',
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(db.messages).toHaveLength(0);

    // ══════════════════════════════════════════════════════════
    // STEP 4: Company reviews and shortlists application with remark
    // ══════════════════════════════════════════════════════════
    const updatedApplication = await applicationsService.updateStatus(
      application.id,
      companyUserId,
      'company',
      {
        status: 'shortlisted',
        remark:
          'Great portfolio! We would like to invite you for an interview this Friday at 11 AM.',
      },
    );

    expect(updatedApplication.status).toBe('shortlisted');
    expect(updatedApplication.companyRemark).toBe(
      'Great portfolio! We would like to invite you for an interview this Friday at 11 AM.',
    );

    // ══════════════════════════════════════════════════════════
    // STEP 5: Verify Company's first message is saved in database
    // ══════════════════════════════════════════════════════════
    expect(db.messages).toHaveLength(1);
    const companyFirstMessage = db.messages[0];
    expect(companyFirstMessage.conversationId).toBe(initialConv.id);
    expect(companyFirstMessage.senderId).toBe(companyUserId);
    expect(companyFirstMessage.text).toBe(
      'Great portfolio! We would like to invite you for an interview this Friday at 11 AM.',
    );
    expect(companyFirstMessage.isRead).toBe(false);

    // Verify conversation snapshot updated
    const convAfterFirstMsg = db.conversations.get(initialConv.id)!;
    expect(convAfterFirstMsg.lastMessage).toBe(companyFirstMessage.text);
    expect(convAfterFirstMsg.unreadCountSeeker).toBe(1);
    expect(convAfterFirstMsg.unreadCountCompany).toBe(0);

    // Verify notification was sent to candidate
    expect(mockNotificationsService.notifyNewMessage).toHaveBeenCalledWith(
      'Construction Boss',
      companyFirstMessage.text,
      initialConv.id,
      candidateUserId,
      companyFirstMessage.id,
    );

    // ══════════════════════════════════════════════════════════
    // STEP 6: Candidate replies to company message
    // ══════════════════════════════════════════════════════════
    const candidateReply = await conversationsService.sendMessage(
      initialConv.id,
      candidateUserId,
      'Thank you! Friday at 11 AM works perfectly for me. Should I bring sample work?',
    );

    // Verify Candidate's reply is saved in database
    expect(db.messages).toHaveLength(2);
    expect(candidateReply.conversationId).toBe(initialConv.id);
    expect(candidateReply.senderId).toBe(candidateUserId);
    expect(candidateReply.text).toBe(
      'Thank you! Friday at 11 AM works perfectly for me. Should I bring sample work?',
    );

    // Verify conversation snapshot updated
    const convAfterReply = db.conversations.get(initialConv.id)!;
    expect(convAfterReply.lastMessage).toBe(candidateReply.text);
    expect(convAfterReply.unreadCountCompany).toBe(1);

    // Verify notification sent to company
    expect(mockNotificationsService.notifyNewMessage).toHaveBeenCalledWith(
      'Skilled Welder',
      candidateReply.text,
      initialConv.id,
      companyUserId,
      candidateReply.id,
    );

    // ══════════════════════════════════════════════════════════
    // STEP 7: Continued chat (Company sends follow-up)
    // ══════════════════════════════════════════════════════════
    const companyFollowup = await conversationsService.sendMessage(
      initialConv.id,
      companyUserId,
      'Yes, please bring your safety certs and past project photos.',
    );

    expect(db.messages).toHaveLength(3);
    expect(companyFollowup.senderId).toBe(companyUserId);
    expect(companyFollowup.text).toBe(
      'Yes, please bring your safety certs and past project photos.',
    );

    // Verify notification sent to candidate for the follow-up
    expect(mockNotificationsService.notifyNewMessage).toHaveBeenCalledWith(
      'Construction Boss',
      companyFollowup.text,
      initialConv.id,
      candidateUserId,
      companyFollowup.id,
    );

    // ══════════════════════════════════════════════════════════
    // STEP 8: Verify listMessages returns all messages in order
    // ══════════════════════════════════════════════════════════
    const allMessages = await conversationsService.listMessages(
      initialConv.id,
      candidateUserId,
      'job_seeker',
    );
    expect(allMessages).toHaveLength(3);
    expect(allMessages[0].id).toBe(companyFirstMessage.id);
    expect(allMessages[1].id).toBe(candidateReply.id);
    expect(allMessages[2].id).toBe(companyFollowup.id);

    // ══════════════════════════════════════════════════════════
    // STEP 9: Mark read
    // ══════════════════════════════════════════════════════════
    await conversationsService.markRead(
      initialConv.id,
      candidateUserId,
      'job_seeker',
    );
    const convAfterRead = db.conversations.get(initialConv.id)!;
    expect(convAfterRead.unreadCountSeeker).toBe(0);
  });
});
