import type { Relation } from 'typeorm';
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
import { User } from '../../users/entities/user.entity.js';

/**
 * Material Transaction — records every material movement on a site.
 * Types: purchase, request, issue, consumption, return
 *
 * Stock is derived: stock = sum(purchase + issue) - sum(consumption + return)
 */
@Entity('material_transactions')
export class MaterialTransaction {
  @PrimaryGeneratedColumn('uuid') id: string;

  /**
   * Transaction type:
   * - purchase: material bought and received on site
   * - request: material request raised by site engineer
   * - issue: material issued from inventory to site
   * - consumption: material consumed/used on site
   * - return: material returned to inventory
   */
  @Column({ type: 'varchar', length: 20 })
  type: string;

  @Column({ type: 'date' }) date: string;

  @Column({ type: 'decimal', precision: 12, scale: 3 }) quantity: number;

  /** Rate per unit */
  @Column({ type: 'decimal', precision: 12, scale: 2 }) rate: number;

  /** Total cost = quantity × rate (calculated server-side) */
  @Column({ type: 'decimal', precision: 12, scale: 2 }) totalCost: number;

  @Column({ type: 'text', nullable: true }) remarks: string;

  /** Optional supplier/vendor name for purchases */
  @Column({ type: 'varchar', length: 200, nullable: true })
  supplier: string;

  /** Optional invoice/reference number */
  @Column({ type: 'varchar', length: 100, nullable: true })
  referenceNumber: string;

  /**
   * Request status (only for type = 'request'):
   * pending → approved → fulfilled | rejected
   */
  @Column({ type: 'varchar', length: 20, nullable: true })
  requestStatus: string;

  @ManyToOne(() => ProjectSite)
  @JoinColumn({ name: 'siteId' })
  site: Relation<ProjectSite>;

  @Column() siteId: string;

  @ManyToOne(() => Material)
  @JoinColumn({ name: 'materialId' })
  material: Relation<Material>;

  @Column() materialId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'createdById' })
  createdBy: Relation<User>;

  @Column({ nullable: true }) createdById: string;

  @CreateDateColumn({ type: 'timestamp' }) createdAt: Date;
  @UpdateDateColumn({ type: 'timestamp' }) updatedAt: Date;
}
