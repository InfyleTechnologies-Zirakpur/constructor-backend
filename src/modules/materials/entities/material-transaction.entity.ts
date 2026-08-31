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
import { Material } from './material.entity.js';

@Entity('material_transactions')
export class MaterialTransaction {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() type: string; // purchase, issue, consume
  @Column({ type: 'decimal', precision: 12, scale: 3 }) quantity: number;
  @Column({ type: 'decimal', precision: 12, scale: 2 }) cost: number;
  @ManyToOne(() => ProjectSite)
  @JoinColumn({ name: 'siteId' })
  site: ProjectSite;
  @Column() siteId: string;
  @ManyToOne(() => Material)
  @JoinColumn({ name: 'materialId' })
  material: Material;
  @Column() materialId: string;
  @CreateDateColumn({ type: 'timestamp' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamp' }) updatedAt: Date;
}
