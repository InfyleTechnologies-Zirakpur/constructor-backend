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
 * Daily Report — aggregates daily operational records for a site.
 *
 * Lifecycle: Draft → Submitted → Reviewed
 *
 * Daily Project Cost = Labour Cost + Material Cost + Site Expenses + Other Costs
 * Estimated Daily Profit = Daily Project Value/Revenue - Daily Project Cost
 *
 * Cost and profit are calculated server-side when the report is submitted.
 */
@Entity('daily_reports')
export class DailyReport {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ type: 'date' }) date: string;

  // ─── Cost Aggregation Fields ──────────────────────

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalLabourCost: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalMaterialCost: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalExpense: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  otherCosts: number;

  /** Daily Project Cost = Labour + Material + Expense + Other (server-calculated) */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalDailyCost: number;

  // ─── Revenue & Profit ─────────────────────────────

  /** Daily project value/revenue as entered by authorized user */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  dailyRevenue: number;

  /** Estimated Daily Profit = dailyRevenue - totalDailyCost (server-calculated) */
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  estimatedProfit: number;

  // ─── Progress & Remarks ───────────────────────────

  @Column({ type: 'int', default: 0 }) progressPercentage: number;

  @Column({ type: 'text', nullable: true }) workCompleted: string;

  @Column({ type: 'text', nullable: true }) remarks: string;

  @Column({ type: 'simple-array', nullable: true })
  attachmentUrls: string[];

  // ─── Status & Lifecycle ───────────────────────────

  /** Draft → Submitted → Reviewed */
  @Column({ default: 'draft' }) status: string;

  // ─── Relationships ────────────────────────────────

  @ManyToOne(() => ProjectSite)
  @JoinColumn({ name: 'siteId' })
  site: Relation<ProjectSite>;

  @Column() siteId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'submittedById' })
  submittedBy: Relation<User>;

  @Column({ nullable: true }) submittedById: string;

  @CreateDateColumn({ type: 'timestamp' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamp' }) updatedAt: Date;
}
