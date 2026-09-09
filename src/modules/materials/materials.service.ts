import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Material } from './entities/material.entity.js';
import { MaterialTransaction } from './entities/material-transaction.entity.js';
import { SiteEngineerAssignment } from '../site-engineers/entities/site-engineer-assignment.entity.js';
import {
  CreateMaterialDto,
  CreateMaterialTransactionDto,
} from './dto/create-materials.dto.js';
import {
  UpdateMaterialDto,
  UpdateMaterialRequestDto,
} from './dto/update-materials.dto.js';

@Injectable()
export class MaterialsService {
  constructor(
    @InjectRepository(Material)
    private readonly materialRepo: Repository<Material>,

    @InjectRepository(MaterialTransaction)
    private readonly transactionRepo: Repository<MaterialTransaction>,

    @InjectRepository(SiteEngineerAssignment)
    private readonly assignmentRepo: Repository<SiteEngineerAssignment>,
  ) {}

  // ═══════════════════════════════════════════════════
  //  MATERIAL MASTER (Admin CRUD)
  // ═══════════════════════════════════════════════════

  async createMaterial(dto: CreateMaterialDto): Promise<Material> {
    const material = this.materialRepo.create({
      name: dto.name,
      unit: dto.unit,
      category: dto.category,
      defaultRate: dto.defaultRate ?? 0,
      description: dto.description,
    });
    return this.materialRepo.save(material);
  }

  async listMaterials(page: number, limit: number, category?: string) {
    const query = this.materialRepo.createQueryBuilder('m');

    if (category) {
      query.where('m.category = :category', { category });
    }

    query.orderBy('m.name', 'ASC');
    query.skip((page - 1) * limit).take(limit);

    const [data, total] = await query.getManyAndCount();
    return { data, total, page, limit };
  }

  async getMaterialById(id: string): Promise<Material> {
    const material = await this.materialRepo.findOne({ where: { id } });
    if (!material) throw new NotFoundException('Material not found');
    return material;
  }

  async updateMaterial(id: string, dto: UpdateMaterialDto): Promise<Material> {
    const material = await this.getMaterialById(id);
    Object.assign(material, dto);
    return this.materialRepo.save(material);
  }

  // ═══════════════════════════════════════════════════
  //  MATERIAL TRANSACTIONS (Site-level operations)
  // ═══════════════════════════════════════════════════

  /**
   * Create a material transaction — purchase, request, issue, consumption, or return.
   * Total cost is calculated server-side.
   */
  async createTransaction(
    siteId: string,
    userId: string,
    role: string,
    dto: CreateMaterialTransactionDto,
  ): Promise<MaterialTransaction> {
    // Verify site access for site engineers
    if (role === 'site_engineer') {
      await this.verifySiteAccess(siteId, userId);
    }

    // Verify material exists
    const material = await this.materialRepo.findOne({
      where: { id: dto.materialId },
    });
    if (!material) throw new NotFoundException('Material not found');

    // Server-side cost calculation
    const totalCost = dto.quantity * dto.rate;

    const transaction = this.transactionRepo.create({
      siteId,
      materialId: dto.materialId,
      type: dto.type,
      date: dto.date,
      quantity: dto.quantity,
      rate: dto.rate,
      totalCost,
      remarks: dto.remarks,
      supplier: dto.supplier,
      referenceNumber: dto.referenceNumber,
      requestStatus: dto.type === 'request' ? 'pending' : undefined,
      createdById: userId,
    });

    return this.transactionRepo.save(transaction);
  }

  /**
   * List transactions for a site with optional filters.
   */
  async listTransactions(
    siteId: string,
    type?: string,
    materialId?: string,
    date?: string,
  ) {
    const query = this.transactionRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.material', 'material')
      .where('t.siteId = :siteId', { siteId });

    if (type) {
      query.andWhere('t.type = :type', { type });
    }

    if (materialId) {
      query.andWhere('t.materialId = :materialId', { materialId });
    }

    if (date) {
      query.andWhere('t.date = :date', { date });
    }

    query.orderBy('t.date', 'DESC').addOrderBy('t.createdAt', 'DESC');

    const transactions = await query.getMany();

    // Calculate total cost for filtered results
    const totalCost = transactions.reduce(
      (sum, t) => sum + Number(t.totalCost),
      0,
    );

    return {
      items: transactions,
      summary: {
        totalRecords: transactions.length,
        totalCost: Number(totalCost.toFixed(2)),
      },
    };
  }

  /**
   * Get stock balance for a site (or a specific material on a site).
   * Stock = sum(purchase + issue) - sum(consumption + return)
   */
  async getStock(siteId: string, materialId?: string) {
    const query = this.transactionRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.material', 'material')
      .where('t.siteId = :siteId', { siteId });

    if (materialId) {
      query.andWhere('t.materialId = :materialId', { materialId });
    }

    const transactions = await query.getMany();

    // Group by material and compute stock
    const stockMap = new Map<
      string,
      {
        materialId: string;
        materialName: string;
        unit: string;
        purchased: number;
        issued: number;
        consumed: number;
        returned: number;
        balance: number;
        totalCost: number;
      }
    >();

    for (const t of transactions) {
      if (!stockMap.has(t.materialId)) {
        stockMap.set(t.materialId, {
          materialId: t.materialId,
          materialName: t.material?.name ?? '',
          unit: t.material?.unit ?? '',
          purchased: 0,
          issued: 0,
          consumed: 0,
          returned: 0,
          balance: 0,
          totalCost: 0,
        });
      }

      const entry = stockMap.get(t.materialId)!;
      const qty = Number(t.quantity);
      const cost = Number(t.totalCost);

      switch (t.type) {
        case 'purchase':
          entry.purchased += qty;
          entry.totalCost += cost;
          break;
        case 'issue':
          entry.issued += qty;
          break;
        case 'consumption':
          entry.consumed += qty;
          break;
        case 'return':
          entry.returned += qty;
          break;
      }
    }

    // Calculate balance
    const items = Array.from(stockMap.values()).map((s) => ({
      ...s,
      balance: Number(
        (s.purchased + s.issued - s.consumed - s.returned).toFixed(3),
      ),
      totalCost: Number(s.totalCost.toFixed(2)),
    }));

    return { items };
  }

  /**
   * Update a material request status (approve, fulfill, reject).
   */
  async updateRequestStatus(
    transactionId: string,
    dto: UpdateMaterialRequestDto,
  ): Promise<MaterialTransaction> {
    const transaction = await this.transactionRepo.findOne({
      where: { id: transactionId },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    if (transaction.type !== 'request') {
      throw new ForbiddenException(
        'Only material requests can have their status updated',
      );
    }

    transaction.requestStatus = dto.requestStatus;
    return this.transactionRepo.save(transaction);
  }

  /**
   * Get material cost summary for a site (feeds into daily cost calculation).
   */
  async getSiteMaterialCost(siteId: string, date?: string): Promise<number> {
    const query = this.transactionRepo
      .createQueryBuilder('t')
      .select('SUM(t.totalCost)', 'total')
      .where('t.siteId = :siteId', { siteId })
      .andWhere('t.type IN (:...types)', {
        types: ['purchase', 'consumption'],
      });

    if (date) {
      query.andWhere('t.date = :date', { date });
    }

    const result = await query.getRawOne();
    return Number(result?.total ?? 0);
  }

  // ─── HELPERS ──────────────────────────────────────

  private async verifySiteAccess(
    siteId: string,
    userId: string,
  ): Promise<void> {
    const assignment = await this.assignmentRepo.findOne({
      where: { siteId, userId, isActive: true },
    });
    if (!assignment) {
      throw new ForbiddenException('You are not assigned to this site');
    }
  }
}
