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
import { User } from '../../users/entities/user.entity.js';

/**
 * Notification — push notification record for a user.
 *
 * Tracks push events like: new_job, application_update, project_assignment,
 * site_assignment, attendance_event, daily_report_submitted, project_update,
 * admin_announcement.
 */
@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ type: 'varchar', length: 200 }) title: string;

  @Column({ type: 'text' }) body: string;

  /**
   * Event type — identifies the business event that triggered this notification.
   * e.g. new_job, application_update, project_assignment, site_assignment,
   * attendance_event, daily_report_submitted, project_update, admin_announcement
   */
  @Column({ type: 'varchar', length: 50 }) event: string;

  /** Optional reference to the related entity (job ID, project ID, report ID, etc.) */
  @Column({ type: 'varchar', length: 100, nullable: true })
  referenceId: string | null;

  @Column({ default: false }) isRead: boolean;

  @Column({ default: false }) isPushed: boolean;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: Relation<User>;

  @Column() userId: string;

  @CreateDateColumn({ type: 'timestamp' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamp' }) updatedAt: Date;
}
