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

@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() entityType: string;
  @Column() entityId: string;
  @Column() objectKey: string; // S3 Key
  @Column() originalFilename: string;
  @Column() mimeType: string;
  @Column({ type: 'int' }) size: number;
  // Live photo + location (seeker/site manager)
  @Column({ type: 'double precision', nullable: true }) latitude: number | null;
  @Column({ type: 'double precision', nullable: true }) longitude: number | null;
  @Column({ type: 'timestamp', nullable: true }) capturedAt: Date | null;
  @Column({ type: 'varchar', default: 'pending' }) verificationStatus: string;
  @ManyToOne(() => User) @JoinColumn({ name: 'ownerId' }) owner: User;
  @Column() ownerId: string;
  @CreateDateColumn({ type: 'timestamp' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamp' }) updatedAt: Date;
}
