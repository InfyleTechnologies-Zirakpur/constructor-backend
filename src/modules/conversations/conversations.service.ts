import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
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
    if (role === 'company') {
      return this.convRepo.find({
        where: { companyId: userId },
        order: { updatedAt: 'DESC' },
        relations: { seeker: true, job: { company: true } },
      });
    }
    if (role === 'job_seeker') {
      return this.convRepo.find({
        where: { seekerId: userId },
        order: { updatedAt: 'DESC' },
        relations: { company: true, job: { company: true } },
      });
    }
    if (role === 'admin') {
      return this.convRepo.find({
        order: { updatedAt: 'DESC' },
        relations: { company: true, seeker: true, job: { company: true } },
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
      relations: { seeker: true, company: true, job: { company: true } },
    });
    if (!conv) throw new NotFoundException('Conversation not found');

    if (role === 'company' && conv.companyId !== userId) {
      throw new ForbiddenException('Not your conversation');
    }
    if (role === 'job_seeker' && conv.seekerId !== userId) {
      throw new ForbiddenException('Not your conversation');
    }
    return conv;
  }

  /**
   * Send a message in a conversation.
   * Validates that the sender is a participant before persisting.
   */
  async sendMessage(
    conversationId: string,
    senderId: string,
    text: string,
  ): Promise<Message> {
    const conv = await this.convRepo.findOne({ where: { id: conversationId } });
    if (!conv) throw new NotFoundException('Conversation not found');

    if (conv.companyId !== senderId && conv.seekerId !== senderId) {
      throw new ForbiddenException('Not part of this conversation');
    }

    const message = this.msgRepo.create({
      conversationId,
      senderId,
      text,
      isRead: false,
    } as Partial<Message>);
    await this.msgRepo.save(message);

    // Update conversation snapshot fields
    conv.lastMessage = text;
    conv.lastMessageAt = new Date();
    if (conv.companyId === senderId) {
      conv.unreadCountSeeker += 1;
    } else {
      conv.unreadCountCompany += 1;
    }
    await this.convRepo.save(conv);

    // Notify the other participant
    const recipientId =
      conv.companyId === senderId ? conv.seekerId : conv.companyId;
    try {
      const sender = await this.userRepo.findOne({
        where: { id: senderId },
        select: { id: true, fullName: true },
      });
      await this.notificationsService.notifyNewMessage(
        sender?.fullName || 'User',
        text,
        conv.id,
        recipientId,
      );
    } catch (err: any) {
      this.logger.error(
        `Failed to send message notification for conversation ${conv.id}: ${err?.message}`,
        err?.stack,
      );
    }

    return message as Message;
  }

  /**
   * List messages in a conversation (oldest first).
   */
  async listMessages(
    conversationId: string,
    userId: string,
    role: string,
  ): Promise<Message[]> {
    await this.getById(conversationId, userId, role);
    return this.msgRepo.find({
      where: { conversationId },
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
    if (role === 'company') {
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
