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
import { ProjectSite } from '../../project-sites/entities/project-site.entity.js';

@Entity('attendance')
export class Attendance {
  @PrimaryGeneratedColumn('uuid') id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: Relation<User>;

  @Column() userId: string;

  @ManyToOne(() => ProjectSite, { nullable: true })
  @JoinColumn({ name: 'siteId' })
  site: Relation<ProjectSite>;

  @Column({ nullable: true }) siteId: string | undefined;

  @Column({ type: 'date' }) date: string;

  @Column({ type: 'timestamp', nullable: true }) checkInTime: Date | null;

  @Column({ type: 'timestamp', nullable: true }) checkOutTime: Date | null;

  @Column({ type: 'decimal', precision: 6, scale: 4, nullable: true })
  checkInLatitude: number | null;

  @Column({ type: 'decimal', precision: 7, scale: 4, nullable: true })
  checkInLongitude: number | null;

  @Column({ type: 'decimal', precision: 6, scale: 4, nullable: true })
  checkOutLatitude: number | null;

  @Column({ type: 'decimal', precision: 7, scale: 4, nullable: true })
  checkOutLongitude: number | null;

  /**
   * Total working hours in minutes (calculated server-side on check-out).
   */
  @Column({ type: 'int', default: 0 }) totalMinutes: number;

  /**
   * Overtime minutes beyond 8h standard (calculated server-side).
   */
  @Column({ type: 'int', default: 0 }) overtimeMinutes: number;

  /**
   * Status: present, half_day, absent, on_leave
   */
  @Column({
    type: 'varchar',
    length: 20,
    default: 'present',
  })
  status: string;

  @CreateDateColumn({ type: 'timestamp' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamp' }) updatedAt: Date;
}
