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

@Entity('attendance')
export class Attendance {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'date' }) date: Date;
  @Column() workerName: string;
  @Column() status: string;
  @ManyToOne(() => ProjectSite)
  @JoinColumn({ name: 'siteId' })
  site: ProjectSite;
  @Column() siteId: string;
  @CreateDateColumn({ type: 'timestamp' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamp' }) updatedAt: Date;
}
