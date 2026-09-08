import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Job } from '../../jobs/entities/job.entity.js';
import { User } from '../../users/entities/user.entity.js';

@Entity('applications')
@Unique(['jobId', 'userId'])
export class Application {
  @PrimaryGeneratedColumn('uuid') id: string;

  @ManyToOne(() => Job)
  @JoinColumn({ name: 'jobId' })
  job: Job;

  @Column() jobId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column() userId: string;

  /**
   * Application status lifecycle:
   * pending → reviewed → shortlisted → accepted | rejected
   */
  @Column({
    type: 'varchar',
    length: 20,
    default: 'pending',
  })
  status: string;

  @Column({ type: 'text', nullable: true })
  coverNote?: string;

  @Column({ type: 'text', nullable: true })
  experience?: string;

  @Column({ type: 'text', nullable: true })
  summary?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  availability?: string;

  @Column({ type: 'text', nullable: true })
  rejectionReason?: string;

  @CreateDateColumn({ type: 'timestamp' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamp' }) updatedAt: Date;
}
