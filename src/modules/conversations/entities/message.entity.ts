import type { Relation } from 'typeorm';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Conversation } from './conversation.entity.js';
import { User } from '../../users/entities/user.entity.js';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid') id: string;

  @ManyToOne(() => Conversation) @JoinColumn({ name: 'conversationId' }) conversation: Relation<Conversation>;
  @Column() conversationId: string;

  @ManyToOne(() => User) @JoinColumn({ name: 'senderId' }) sender: Relation<User>;
  @Column() senderId: string;

  @Column({ type: 'text' }) text: string;
  @Column({ default: false }) isRead: boolean;

  @CreateDateColumn({ type: 'timestamp' }) createdAt: Date;
}