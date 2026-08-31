import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Project } from '../../projects/entities/project.entity.js';

@Entity('project_sites')
export class ProjectSite {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() name: string;
  @Column() location: string;
  @Column({ default: 'active' }) status: string;
  @ManyToOne(() => Project) @JoinColumn({ name: 'projectId' }) project: Project;
  @Column() projectId: string;
  @CreateDateColumn({ type: 'timestamp' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamp' }) updatedAt: Date;
}
