import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('materials')
export class Material {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() name: string;
  @Column() unit: string;
  @Column({ type: 'decimal', precision: 12, scale: 2 }) defaultCost: number;
  @CreateDateColumn({ type: 'timestamp' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamp' }) updatedAt: Date;
}
