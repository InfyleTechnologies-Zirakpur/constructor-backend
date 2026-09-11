import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity('saved_jobs')
@Unique(['userId', 'jobId'])
export class SavedJob {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column() userId: string;

  @Column() jobId: string;

  @CreateDateColumn({ type: 'timestamp' }) createdAt: Date;
}
