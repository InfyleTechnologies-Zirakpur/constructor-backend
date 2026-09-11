import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Company } from '../../companies/entities/company.entity.js';

@Entity('jobs')
export class Job {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column() title: string;

  @Column() location: string;

  @Column('simple-array', { nullable: true }) skills: string[];

  @Column({ type: 'text' }) description: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  compensation: number;

  /** Daily pay in local currency (integer), used by the Flutter worker app. */
  @Column({ type: 'int', default: 0 }) dailyPay: number;

  @Column({ type: 'int', default: 1 }) workforceRequired: number;

  /** e.g. 'Full-time', 'Contract', 'Daily Wage' */
  @Column({ type: 'varchar', length: 50, default: 'Full-time' })
  projectType: string;

  /** e.g. 'Fresher', 'Experienced', 'Any' */
  @Column({ type: 'varchar', length: 50, default: 'Any' })
  experienceLevel: string;

  /** JSON array of requirement strings for the Flutter detail sheet. */
  @Column('simple-array', { nullable: true }) requirements: string[];

  @Column({
    type: 'varchar',
    length: 20,
    default: 'draft',
  })
  status: string; // draft, published, closed, rejected

  @Column({ type: 'text', nullable: true })
  moderationRemarks?: string;

  @ManyToOne(() => Company)
  @JoinColumn({ name: 'companyId' })
  company: Company;

  @Column() companyId: string;

  @CreateDateColumn({ type: 'timestamp' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamp' }) updatedAt: Date;
}
