import {
  Injectable,
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

@Injectable()
export class ConversationsService {
  constructor(
    @InjectRepository(Conversation) private readonly convRepo: Repository<Conversation>,
    @InjectRepository(Message) private readonly msgRepo: Repository<Message>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Job) private readonly jobRepo: Repository<Job>,
    @InjectRepository(Application) private readonly appRepo: Repository<Application>,
  ) {}

  /**
   * Find or create a conversation between a company and a seeker for a job/application.
   * Called when seeker applies or company shortlists.
   */
  async findOrCreate(
    companyId: string,
    seekerId: string,
    jobId: string,
    applicationId?: string,
  ): Promise<Conversation> {
    const where: any = { companyId, seekerId, jobId };
    if (applicationId) where.applicationId = applicationId;

    let conversation = await this.convRepo.findOne({ where });
    if (conversation) return conversation;

    // Verify entities exist
    const [company, seeker, job] = await Promise.all([
      this.userRepo.findOne({ where: { id: companyId } }),
      this.userRepo.findOne({ where: { id: seekerId } }),
      this.jobRepo.findOne({ where: { id: jobId } }),
    ]);
    if (!company) throw new NotFoundException('Company not found');
    if (!seeker) throw new NotFoundException('Seeker not found');
    if (!job) throw new NotFoundException('Job not found');
    if (applicationId) {
      const app = await this.appRepo.findOne({ where: { id: applicationId } });
      if (!app) throw new NotFoundException('Application not found');
    }

    const newConversation = this.convRepo.create({
      companyId,
      seekerId,
      jobId,
      applicationId: applicationId ?? null,
    } as any);
    const saved = await this.convRepo.save(newConversation);
    return Array.isArray(saved) ? saved[0] : saved;
  }

  /**
   * Get all conversations for a user (company or seeker).
   */
  async listForUser(userId: string, role: string) {
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

  async getById(id: string, userId: string, role: string) {
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
   */
  async sendMessage(
    conversationId: string,
    senderId: string,
    text: string,
  ) {
    const conv = await this.convRepo.findOne({ where: { id: conversationId } });
    if (!conv) throw new NotFoundException('Conversation not found');

    // Verify sender is part of conversation
    if (conv.companyId !== senderId && conv.seekerId !== senderId) {
      throw new ForbiddenException('Not part of this conversation');
    }

    const message = this.msgRepo.create({
      conversationId,
      senderId,
      text,
      isRead: false,
    } as any);
    await this.msgRepo.save(message);

    // Update conversation last message
    conv.lastMessage = text;
    conv.lastMessageAt = new Date();
    if (conv.companyId === senderId) {
      conv.unreadCountSeeker += 1;
    } else {
      conv.unreadCountCompany += 1;
    }
    await this.convRepo.save(conv);

    return message;
  }

  /**
   * List messages in a conversation.
   */
  async listMessages(conversationId: string, userId: string, role: string) {
    const conv = await this.getById(conversationId, userId, role);
    return this.msgRepo.find({
      where: { conversationId },
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Mark messages as read.
   */
  async markRead(conversationId: string, userId: string, role: string) {
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