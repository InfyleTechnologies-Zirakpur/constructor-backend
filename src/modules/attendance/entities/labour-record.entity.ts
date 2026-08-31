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
  @Column({ type: 'date' }) date: Date;
  @Column({ type: 'int' }) headcount: number;
  @Column({ type: 'decimal', precision: 12, scale: 2 }) dailyWage: number;
  @Column({ type: 'decimal', precision: 12, scale: 2 }) totalCost: number;
  @ManyToOne(() => ProjectSite)
  @JoinColumn({ name: 'siteId' })
  site: ProjectSite;
  @Column() siteId: string;
  @CreateDateColumn({ type: 'timestamp' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamp' }) updatedAt: Date;
}
