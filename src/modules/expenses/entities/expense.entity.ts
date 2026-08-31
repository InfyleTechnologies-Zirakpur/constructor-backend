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

@Entity('expenses')
export class Expense {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'date' }) date: Date;
  @Column({ type: 'decimal', precision: 12, scale: 2 }) amount: number;
  @Column() category: string;
  @Column({ type: 'text', nullable: true }) description: string;
  @ManyToOne(() => ProjectSite)
  @JoinColumn({ name: 'siteId' })
  site: ProjectSite;
  @Column() siteId: string;
  @CreateDateColumn({ type: 'timestamp' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamp' }) updatedAt: Date;
}
