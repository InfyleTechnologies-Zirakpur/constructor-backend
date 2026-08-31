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
  @Column('simple-array') skills: string[];
  @Column({ type: 'text' }) description: string;
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  compensation: number;
  @Column({ type: 'int', default: 1 }) workforceRequired: number;
  @Column({ default: 'draft' }) status: string;
  @ManyToOne(() => Company) @JoinColumn({ name: 'companyId' }) company: Company;
  @Column() companyId: string;
  @CreateDateColumn({ type: 'timestamp' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamp' }) updatedAt: Date;
}
