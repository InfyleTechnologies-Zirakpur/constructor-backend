import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() action: string;
  @Column() entityType: string;
  @Column() entityId: string;
  @Column({ type: 'jsonb', nullable: true }) metadata: any;
  @ManyToOne(() => User) @JoinColumn({ name: 'actorId' }) actor: User;
  @Column() actorId: string;
  @CreateDateColumn({ type: 'timestamp' }) createdAt: Date;
}
