import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Job } from '../../jobs/entities/job.entity.js';
import { User } from '../../users/entities/user.entity.js';

@Entity('applications')
export class Application {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ default: 'submitted' }) status: string;
  @ManyToOne(() => Job) @JoinColumn({ name: 'jobId' }) job: Job;
  @Column() jobId: string;
  @ManyToOne(() => User) @JoinColumn({ name: 'userId' }) user: User;
  @Column() userId: string;
  @CreateDateColumn({ type: 'timestamp' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamp' }) updatedAt: Date;
}
