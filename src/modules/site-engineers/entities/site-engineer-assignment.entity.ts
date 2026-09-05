import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';
import { ProjectSite } from '../../project-sites/entities/project-site.entity.js';

@Entity('site_engineer_assignments')
export class SiteEngineerAssignment {
  @PrimaryGeneratedColumn('uuid') id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column() userId: string;

  @ManyToOne(() => ProjectSite, (site) => site.engineerAssignments)
  @JoinColumn({ name: 'siteId' })
  site: ProjectSite;

  @Column() siteId: string;

  @Column({ default: true }) isActive: boolean;

  @CreateDateColumn({ type: 'timestamp' }) assignedAt: Date;
}
