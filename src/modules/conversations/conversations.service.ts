import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from './entities/conversation.entity.js';
import { Message } from './entities/message.entity.js';
import { User } from '../users/entities/user.entity.js';
import { Job } from '../jobs/entities/job.entity.js';
import { Application } from '../applications/entities/application.entity.js';
import { NotificationsService } from '../notifications/notifications.service.js';

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(
    @InjectRepository(Conversation)
    private readonly convRepo: Repository<Conversation>,
    @InjectRepository(Message) private readonly msgRepo: Repository<Message>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Job) private readonly jobRepo: Repository<Job>,
    @InjectRepository(Application)
    private readonly appRepo: Repository<Application>,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Find or create a conversation between a company user and a seeker for a specific job.
   * Uniqueness is determined by (companyId, seekerId, jobId). applicationId is stored
   * but NOT used as part of the uniqueness key to avoid duplicate conversations.
   */
  async findOrCreate(
    companyUserId: string,
    seekerId: string,
    jobId: string,
    applicationId: string,
  ): Promise<Conversation> {
    // Always search by the three stable keys — never include applicationId in where
    const existing = await this.convRepo.findOne({
      where: { companyId: companyUserId, seekerId, jobId },
    });
    if (existing) {
      // Patch applicationId if it was missing (e.g. created before application was saved)
      if (!existing.applicationId && applicationId) {
        existing.applicationId = applicationId;
        await this.convRepo.save(existing);
      }
      return existing;
    }

    // Verify all referenced entities exist before creating the conversation
    const [company, seeker, job, application] = await Promise.all([
      this.userRepo.findOne({ where: { id: companyUserId } }),
      this.userRepo.findOne({ where: { id: seekerId } }),
      this.jobRepo.findOne({ where: { id: jobId } }),
      this.appRepo.findOne({ where: { id: applicationId } }),
    ]);

    if (!company) throw new NotFoundException('Company user not found');
    if (!seeker) throw new NotFoundException('Seeker not found');
    if (!job) throw new NotFoundException('Job not found');
    if (!application) throw new NotFoundException('Application not found');

    const conversation = this.convRepo.create({
      companyId: companyUserId,
      seekerId,
      jobId,
      applicationId,
    } as Partial<Conversation>);

    return this.convRepo.save(conversation) as Promise<Conversation>;
  }

  /**
   * Get all conversations for a user (company or seeker), newest first.
   */
  async listForUser(userId: string, role: string): Promise<Conversation[]> {
    if (
      role === 'company' ||
      role === 'contractor' ||
      role === 'site_engineer'
    ) {
      return this.convRepo.find({
        where: { companyId: userId },
        order: { updatedAt: 'DESC' },
        relations: { seeker: true, job: { company: true }, application: true },
      });
    }
    if (role === 'job_seeker') {
      return this.convRepo.find({
        where: { seekerId: userId },
        order: { updatedAt: 'DESC' },
        relations: { company: true, job: { company: true }, application: true },
      });
    }
    if (role === 'admin') {
      return this.convRepo.find({
        order: { updatedAt: 'DESC' },
        relations: {
          company: true,
          seeker: true,
          job: { company: true },
          application: true,
        },
      });
    }
    return [];
  }

  async getById(
    id: string,
    userId: string,
    role: string,
  ): Promise<Conversation> {
    const conv = await this.convRepo.findOne({
      where: { id },
      relations: {
        seeker: true,
        company: true,
        job: { company: true },
        application: true,
      },
    });
    if (!conv) throw new NotFoundException('Conversation not found');

    if (
      role !== 'admin' &&
      conv.companyId !== userId &&
      conv.seekerId !== userId
    ) {
      throw new ForbiddenException('Not your conversation');
    }
    return conv;
  }

  /**
   * Send a message in a conversation.
   *
   * Enforces message flow:
   * 1. Candidate must NOT be able to send the first message (company must initiate).
   * 2. Company must send the first message only after application is accepted, rejected, or shortlisted.
   * 3. Once company sends first message, candidate can reply and continue chatting.
   * 4. Deduplicates rapid identical submissions within 5 seconds.
   * 5. Triggers notification only AFTER message is successfully stored in DB.
   */
  async sendMessage(
    conversationId: string,
    senderId: string,
    text: string,
  ): Promise<Message> {
    const trimmedText = text?.trim();
    if (!trimmedText) {
      throw new BadRequestException('Message text cannot be empty');
    }

    const conv = await this.convRepo.findOne({
      where: { id: conversationId },
      relations: { application: true },
    });
    if (!conv) throw new NotFoundException('Conversation not found');

    const isCompany = conv.companyId === senderId;
    const isSeeker = conv.seekerId === senderId;

    if (!isCompany && !isSeeker) {
      const senderUser = await this.userRepo.findOne({
        where: { id: senderId },
        select: { id: true, role: true },
      });
      if (senderUser?.role !== 'admin') {
        throw new ForbiddenException('Not part of this conversation');
      }
    }

    // Check count of messages sent by company in this conversation
    const companyMessageCount = await this.msgRepo.count({
      where: {
        conversationId,
        senderId: conv.companyId,
      },
    });

    // Rule 1: Candidate must not be able to send the first message
    if (isSeeker && companyMessageCount === 0) {
      throw new ForbiddenException(
        'The candidate cannot send the first message. The company must initiate the conversation.',
      );
    }

    // Rule 2: Company can only initiate conversation after application is accepted, rejected, or shortlisted
    if (isCompany && companyMessageCount === 0) {
      let application = conv.application;
      if (!application && conv.applicationId) {
        application = await this.appRepo.findOne({
          where: { id: conv.applicationId },
        });
      }

      if (application) {
        const allowedStatuses = ['accepted', 'rejected', 'shortlisted'];
        if (!allowedStatuses.includes(application.status)) {
          throw new ForbiddenException(
            'The company can only send the first message after the application is accepted, rejected, or shortlisted.',
          );
        }
      }
    }

    // Rule 3: Prevent duplicate messages from rapid identical submissions (within 5 seconds)
    const fiveSecondsAgo = new Date(Date.now() - 5000);
    const recentDuplicate = await this.msgRepo.findOne({
      where: {
        conversationId,
        senderId,
        text: trimmedText,
      },
      order: { createdAt: 'DESC' },
    });
    if (
      recentDuplicate &&
      recentDuplicate.createdAt &&
      new Date(recentDuplicate.createdAt).getTime() >= fiveSecondsAgo.getTime()
    ) {
      return recentDuplicate;
    }

    // Rule 4: Persist message to database
    const message = this.msgRepo.create({
      conversationId,
      senderId,
      text: trimmedText,
      isRead: false,
    } as Partial<Message>);
    const savedMessage = await this.msgRepo.save(message);

    // Rule 5: Update conversation snapshot
    conv.lastMessage = trimmedText;
    conv.lastMessageAt = new Date();
    if (isCompany) {
      conv.unreadCountSeeker = (Number(conv.unreadCountSeeker) || 0) + 1;
    } else {
      conv.unreadCountCompany = (Number(conv.unreadCountCompany) || 0) + 1;
    }
    await this.convRepo.save(conv);

    // Rule 6: Dispatch notification ONLY AFTER message is saved in DB
    const recipientId = isCompany ? conv.seekerId : conv.companyId;
    try {
      const sender = await this.userRepo.findOne({
        where: { id: senderId },
        select: { id: true, fullName: true },
      });
      await this.notificationsService.notifyNewMessage(
        sender?.fullName || 'User',
        trimmedText,
        conv.id,
        recipientId,
        savedMessage.id,
      );
    } catch (err: any) {
      this.logger.error(
        `Failed to send message notification for conversation ${conv.id}: ${err?.message}`,
        err?.stack,
      );
    }

    return savedMessage;
  }

  /**
   * List messages in a conversation (oldest first) with sanitized sender info.
   */
  async listMessages(
    conversationId: string,
    userId: string,
    role: string,
  ): Promise<Message[]> {
    await this.getById(conversationId, userId, role);
    return this.msgRepo.find({
      where: { conversationId },
      relations: { sender: true },
      select: {
        id: true,
        conversationId: true,
        senderId: true,
        text: true,
        isRead: true,
        createdAt: true,
        sender: {
          id: true,
          fullName: true,
          avatarUrl: true,
          role: true,
        },
      },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Mark all unread messages in a conversation as read for the calling user.
   */
  async markRead(
    conversationId: string,
    userId: string,
    role: string,
  ): Promise<{ updated: boolean }> {
    const conv = await this.getById(conversationId, userId, role);
    if (
      role === 'company' ||
      role === 'contractor' ||
      role === 'site_engineer'
    ) {
      conv.unreadCountCompany = 0;
    } else {
      conv.unreadCountSeeker = 0;
    }
    await this.convRepo.save(conv);
    await this.msgRepo.update(
      { conversationId, isRead: false },
      { isRead: true },
    );
    return { updated: true };
  }
}
