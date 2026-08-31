import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() fullName: string;
  @Column({ unique: true }) email: string;
  @Column({ nullable: true }) phone?: string;
  @Column() passwordHash: string;
  @Column({ type: 'varchar', length: 30 }) role: string;
  @Column({ default: true }) isActive: boolean;
  @Column({ type: 'varchar', nullable: true }) avatarUrl: string | null;
  @Column({ type: 'varchar', nullable: true }) otpHash: string | null;
  @Column({ type: 'timestamp', nullable: true }) otpExpiresAt: Date | null;
  @Column({ type: 'varchar', nullable: true }) refreshTokenHash: string | null;
  @CreateDateColumn({ type: 'timestamp' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamp' }) updatedAt: Date;
}
