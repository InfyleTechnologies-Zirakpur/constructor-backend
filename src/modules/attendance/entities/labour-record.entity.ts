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

@Entity('labour_records')
export class LabourRecord {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ type: 'date' }) date: string;

  /** Number of labourers on site */
  @Column({ type: 'int' }) headcount: number;

  /** Category/type of labour (e.g. skilled, unskilled, helper) */
  @Column({ type: 'varchar', length: 50, nullable: true })
  category: string;

  /** Daily wage per labourer */
  @Column({ type: 'decimal', precision: 12, scale: 2 }) dailyWage: number;

  /** Overtime hours */
  @Column({ type: 'decimal', precision: 6, scale: 2, default: 0 })
  overtimeHours: number;

  /** Overtime rate per hour */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  overtimeRate: number;

  /**
   * Total cost = (headcount × dailyWage) + (overtimeHours × overtimeRate)
   * Calculated server-side.
   */
  @Column({ type: 'decimal', precision: 12, scale: 2 }) totalCost: number;

  @Column({ type: 'text', nullable: true }) remarks: string;

  @ManyToOne(() => ProjectSite)
  @JoinColumn({ name: 'siteId' })
  site: Relation<ProjectSite>;

  @Column() siteId: string;

  @CreateDateColumn({ type: 'timestamp' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamp' }) updatedAt: Date;
}
