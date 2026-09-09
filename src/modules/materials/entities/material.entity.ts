import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Master material definition — defines a material type available
 * across all projects/sites. Admin manages this catalog.
 */
@Entity('materials')
export class Material {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column() name: string;

  @Column({ type: 'varchar', length: 50 }) unit: string; // kg, bag, cft, m³, piece, litre, etc.

  @Column({ type: 'varchar', length: 100, nullable: true })
  category: string; // cement, sand, steel, aggregate, paint, etc.

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  defaultRate: number; // default rate per unit

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: true }) isActive: boolean;

  @CreateDateColumn({ type: 'timestamp' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamp' }) updatedAt: Date;
}
