import type { Relation } from 'typeorm';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ProjectSite } from '../../project-sites/entities/project-site.entity.js';
import { User } from '../../users/entities/user.entity.js';

/**
 * Expense Entity — tracks project/site expenses and attachments.
 * Feeds into daily project cost.
 */
@Entity('expenses')
export class Expense {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ type: 'date' }) date: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 }) amount: number;

  @Column({ type: 'varchar', length: 100 }) category: string;

  @Column({ type: 'text', nullable: true }) description: string;

  @Column({ type: 'text', nullable: true }) remarks: string;

  /** Reference to S3 object key or URL */
  @Column({ type: 'varchar', length: 500, nullable: true })
  attachmentUrl: string;

  @ManyToOne(() => ProjectSite)
  @JoinColumn({ name: 'siteId' })
  site: Relation<ProjectSite>;

  @Column() siteId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'createdById' })
  createdBy: Relation<User>;

  @Column({ nullable: true }) createdById: string;

  @CreateDateColumn({ type: 'timestamp' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamp' }) updatedAt: Date;
}
