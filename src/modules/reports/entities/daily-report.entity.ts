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

@Entity('daily_reports')
export class DailyReport {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'date' }) date: Date;
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalLabourCost: number;
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalMaterialCost: number;
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalExpense: number;
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  estimatedProfit: number;
  @Column({ default: 'draft' }) status: string;
  @ManyToOne(() => ProjectSite)
  @JoinColumn({ name: 'siteId' })
  site: ProjectSite;
  @Column() siteId: string;
  @CreateDateColumn({ type: 'timestamp' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamp' }) updatedAt: Date;
}
