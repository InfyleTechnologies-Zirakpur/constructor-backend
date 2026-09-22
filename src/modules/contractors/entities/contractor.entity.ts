import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';

@Entity('contractors')
export class Contractor {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column() companyName: string;

  @Column({ nullable: true }) registrationNumber?: string;

  @Column({ nullable: true }) gstNumber?: string;

  @Column({ nullable: true }) panNumber?: string;

  @Column() contactEmail: string;

  @Column() contactPhone: string;

  @Column({ nullable: true }) alternatePhone?: string;

  @Column({ nullable: true }) website?: string;

  @Column({ type: 'text', nullable: true }) address?: string;

  @Column({ nullable: true }) city?: string;

  @Column({ nullable: true }) state?: string;

  @Column({ nullable: true }) pincode?: string;

  @Column({ nullable: true }) businessType?: string; // proprietorship/partnership/privateLimited/llp/individual

  @Column({ type: 'int', nullable: true }) yearEstablished?: number;

  @Column({ nullable: true }) teamSizeRange?: string; // 1-10, 10-50 etc

  @Column('jsonb', { nullable: true, default: [] }) specializations?: string[];

  @Column('jsonb', { nullable: true, default: [] }) operationalAreas?: string[];

  @Column({ nullable: true }) logoUrl?: string;

  @Column({ type: 'text', nullable: true }) description?: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'pending',
  })
  verificationStatus: string;

  @Column({ type: 'text', nullable: true }) verificationRemarks?: string;

  @Column('jsonb', { nullable: true, default: [] }) documentUrls?: string[];

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column() userId: string;

  @CreateDateColumn({ type: 'timestamp' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamp' }) updatedAt: Date;
}
