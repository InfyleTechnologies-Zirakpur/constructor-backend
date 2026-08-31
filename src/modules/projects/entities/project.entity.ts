import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Contractor } from '../../contractors/entities/contractor.entity.js';

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() name: string;
  @Column() location: string;
  @Column({ type: 'int', default: 30 }) durationDays: number;
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  budget: number;
  @Column({ default: 'draft' }) status: string;
  @ManyToOne(() => Contractor)
  @JoinColumn({ name: 'contractorId' })
  contractor: Contractor;
  @Column() contractorId: string;
  @CreateDateColumn({ type: 'timestamp' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamp' }) updatedAt: Date;
}
