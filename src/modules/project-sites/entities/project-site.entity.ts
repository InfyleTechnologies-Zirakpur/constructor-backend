import type { Relation } from 'typeorm';
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
 
} from 'typeorm';
import { Project } from '../../projects/entities/project.entity.js';
import { SiteEngineerAssignment } from '../../site-engineers/entities/site-engineer-assignment.entity.js';

@Entity('project_sites')
export class ProjectSite {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column() name: string;

  @Column() location: string;

  @Column({ type: 'text', nullable: true }) description?: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'active',
  })
  status: string;

  @ManyToOne(() => Project, (project) => project.sites)
  @JoinColumn({ name: 'projectId' })
  project: Relation<Project>;

  @Column() projectId: string;

  @OneToMany(() => SiteEngineerAssignment, (assignment) => assignment.site)
  engineerAssignments: Relation<SiteEngineerAssignment>[];

  @CreateDateColumn({ type: 'timestamp' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamp' }) updatedAt: Date;
}
