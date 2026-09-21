import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  // ── Primary / Identity ──────────────────────────
  @PrimaryGeneratedColumn('uuid')
  id: string; // sub in JWT

  @Index({ unique: true })
  @Column({ type: 'varchar', unique: true, nullable: true })
  employeeId: string | null; // global employee code e.g. EMP-0001, nullable until assigned

  // ── Profile ─────────────────────────────────────
  @Column({ type: 'varchar' })
  fullName: string;

  @Column({ type: 'varchar', nullable: true })
  displayName: string | null;

  @Column({ type: 'varchar', nullable: true })
  avatarUrl: string | null;

  // ── Contact ─────────────────────────────────────
  @Index({ unique: true })
  @Column({ type: 'varchar', unique: true, nullable: true })
  email: string | null;

  @Column({ default: false })
  emailVerified: boolean;

  @Index({ unique: true })
  @Column({ type: 'varchar', unique: true, nullable: true })
  phone: string | null;

  @Column({ default: false })
  phoneVerified: boolean;

  // ── Auth ────────────────────────────────────────
  @Column({ type: 'varchar', nullable: true })
  passwordHash: string | null; // nullable for OTP-only seekers

  @Column({ type: 'varchar', length: 30, default: 'job_seeker' })
  role: string; // admin | job_seeker | company | contractor | site_engineer

  @Column({ type: 'jsonb', nullable: true })
  policy: Record<string, any> | null; // fine-grained permissions e.g. {canPostJob:true}
  // keep flexible so RBAC can evolve without ALTER TABLE

  // ── Verification / Blocking ─────────────────────
  @Column({ default: false })
  isVerified: boolean; // KYC / company verified / contractor verified unified flag

  @Column({ default: false })
  isBlocked: boolean;

  @Column({ type: 'varchar', nullable: true })
  blockedReason: string | null;

  @Column({ type: 'timestamp', nullable: true })
  blockedAt: Date | null;

  @Column({ default: true })
  isActive: boolean; // soft disable without hard block

  @Column({ type: 'varchar', nullable: true })
  deactivatedReason: string | null;

  // ── Security / OTP / Tokens ─────────────────────
  @Column({ type: 'varchar', nullable: true })
  otpHash: string | null;

  @Column({ type: 'timestamp', nullable: true })
  otpExpiresAt: Date | null;

  @Column({ type: 'varchar', nullable: true })
  refreshTokenHash: string | null;

  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt: Date | null;

  @Column({ type: 'int', default: 0 })
  loginCount: number;

  @Column({ type: 'int', default: 0 })
  failedLoginAttempts: number;

  @Column({ type: 'timestamp', nullable: true })
  lockoutUntil: Date | null;

  @Column({ type: 'int', default: 0 })
  tokenVersion: number; // bump to invalidate all old JWTs — single-session

  // ── Worker / Domain Profile (kept JSONB-flexible) ──
  @Column({ type: 'varchar', nullable: true })
  city: string | null;

  @Column('simple-array', { nullable: true })
  skills: string[] | null;

  @Column({ type: 'varchar', nullable: true })
  salaryExpectation: string | null;

  @Column({ type: 'jsonb', nullable: true })
  experience: any[] | null;

  @Column({ type: 'jsonb', nullable: true })
  education: any[] | null;

  @Column({ type: 'jsonb', nullable: true })
  documents: any[] | null; // unified document refs

  @Column({ type: 'jsonb', nullable: true })
  preferences: Record<string, any> | null; // locale, notifications

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null; // any future field without ALTER

  // ── Audit ───────────────────────────────────────
  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamp', nullable: true })
  deletedAt: Date | null; // soft delete so FKs never break
}
