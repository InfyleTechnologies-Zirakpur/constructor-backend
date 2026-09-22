import type { Relation } from 'typeorm';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';
import { Job } from '../../jobs/entities/job.entity.js';
import { Application } from '../../applications/entities/application.entity.js';
import { Message } from './message.entity.js';

@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid') id: string;

  @ManyToOne(() => User) @JoinColumn({ name: 'companyId' }) company: Relation<User>;
  @Column() companyId: string;

  @ManyToOne(() => User) @JoinColumn({ name: 'seekerId' }) seeker: Relation<User>;
  @Column() seekerId: string;

  @ManyToOne(() => Job) @JoinColumn({ name: 'jobId' }) job: Relation<Job>;
  @Column() jobId: string;

  @ManyToOne(() => Application, { nullable: true }) @JoinColumn({ name: 'applicationId' }) application: Relation<Application>;
  @Column({ nullable: true }) applicationId: string | null;

  @Column({ type: 'text', nullable: true }) lastMessage: string;
  @Column({ type: 'timestamp', nullable: true }) lastMessageAt: Date | null;
  @Column({ default: 0 }) unreadCountCompany: number;
  @Column({ default: 0 }) unreadCountSeeker: number;

  @OneToMany(() => Message, (m) => m.conversation) messages: Relation<Message[]>;

  @CreateDateColumn({ type: 'timestamp' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamp' }) updatedAt: Date;
}