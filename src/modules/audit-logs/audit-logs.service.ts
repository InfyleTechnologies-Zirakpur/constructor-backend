import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity.js';
import { CreateAuditLogDto } from './dto/create-audit-logs.dto.js';

@Injectable()
export class AuditLogsService {
  constructor(@InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>) {}

  async create(actorId: string, dto: CreateAuditLogDto): Promise<AuditLog> {
    const log = this.repo.create({ ...dto, actorId } as any);
    const saved: any = await this.repo.save(log as any);
    return Array.isArray(saved) ? saved[0] : saved;
  }

  // helper for interceptors/services
  async log(actorId: string, action: string, entityType: string, entityId: string, metadata?: any) {
    return this.create(actorId, { action, entityType, entityId, metadata });
  }

  async list(page = 1, limit = 20, entityType?: string, actorId?: string) {
    const qb = this.repo.createQueryBuilder('a').leftJoinAndSelect('a.actor', 'actor').orderBy('a.createdAt', 'DESC');
    if (entityType) qb.andWhere('a.entityType = :entityType', { entityType });
    if (actorId) qb.andWhere('a.actorId = :actorId', { actorId });
    qb.skip((page - 1) * limit).take(limit);
    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async getById(id: string) {
    return this.repo.findOne({ where: { id }, relations: { actor: true } });
  }
}
