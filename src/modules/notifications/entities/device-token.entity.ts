import type { Relation } from 'typeorm';
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
import { User } from '../../users/entities/user.entity.js';

/**
 * DeviceToken — stores FCM device tokens per user.
 * A user can have multiple devices (phone, tablet, etc.).
 * Unique constraint on (userId, token) prevents duplicate registrations.
 */
@Entity('device_tokens')
@Unique(['userId', 'token'])
export class DeviceToken {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ type: 'text' }) token: string;

  /** Platform identifier: 'android', 'ios', 'web' */
  @Column({ type: 'varchar', length: 20, default: 'android' })
  platform: string;

  @Column({ default: true }) isActive: boolean;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: Relation<User>;

  @Column() userId: string;

  @CreateDateColumn({ type: 'timestamp' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamp' }) updatedAt: Date;
}
