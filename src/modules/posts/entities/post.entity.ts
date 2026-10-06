import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';

@Entity('posts')
export class Post {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  title: string | null;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text', nullable: true })
  coverPhoto: string | null;

  @Column({ type: 'jsonb', nullable: true, default: () => "'[]'" })
  photos: string[];

  @Column({ type: 'jsonb', nullable: true, default: () => "'[]'" })
  tags: string[];

  @Column({ type: 'varchar', length: 255, nullable: true })
  location: string | null;

  @Column({ type: 'double precision', nullable: true })
  latitude: number | null;

  @Column({ type: 'double precision', nullable: true })
  longitude: number | null;

  @Column({ type: 'varchar', length: 30, default: 'PUBLIC' })
  visibility: string;

  @Column({ type: 'varchar', length: 30, default: 'PUBLIC' })
  status: string;

  @Column({
    type: 'int',
    default: 0,
    transformer: {
      to: (value: number) =>
        typeof value === 'number' ? value : Number(value) || 0,
      from: (value: any) =>
        value !== null && value !== undefined ? Number(value) : 0,
    },
  })
  likesCount: number;

  @Column({
    type: 'int',
    default: 0,
    transformer: {
      to: (value: number) =>
        typeof value === 'number' ? value : Number(value) || 0,
      from: (value: any) =>
        value !== null && value !== undefined ? Number(value) : 0,
    },
  })
  commentsCount: number;

  @Column({
    type: 'int',
    default: 0,
    transformer: {
      to: (value: number) =>
        typeof value === 'number' ? value : Number(value) || 0,
      from: (value: any) =>
        value !== null && value !== undefined ? Number(value) : 0,
    },
  })
  sharesCount: number;

  @Index()
  @Column({ type: 'uuid' })
  authorId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'authorId' })
  author: User;

  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamp', nullable: true })
  deletedAt: Date | null;
}
