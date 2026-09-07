import type { Relation } from 'typeorm';
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Contractor } from '../../contractors/entities/contractor.entity.js';
import { ProjectSite } from '../../project-sites/entities/project-site.entity.js';

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column() name: string;

  @Column({ type: 'text', nullable: true }) description?: string;

  @Column() location: string;

  @Column({ type: 'int', default: 30 }) durationDays: number;

  @Column({ type: 'date', nullable: true }) startDate?: Date;

  @Column({ type: 'date', nullable: true }) endDate?: Date;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  budget: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  contractValue: number;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'draft',
  })
  status: string;

  @ManyToOne(() => Contractor)
  @JoinColumn({ name: 'contractorId' })
  contractor: Contractor;

  @Column() contractorId: string;

  @OneToMany(() => ProjectSite, (site) => site.project)
  sites: Relation<ProjectSite>[];

  @CreateDateColumn({ type: 'timestamp' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamp' }) updatedAt: Date;
}
