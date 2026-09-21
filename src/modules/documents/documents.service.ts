import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as path from 'path';
import { Document } from './entities/document.entity.js';

const ALLOWED_TYPES: Record<string, { roles: string[]; mime: string[]; max: number; needLocation: boolean }> = {
  user_avatar: { roles: ['job_seeker','company','contractor','site_engineer','admin'], mime: ['image/jpeg','image/png','image/webp'], max: 5*1024*1024, needLocation: false },
  seeker_live_photo: { roles: ['job_seeker'], mime: ['image/jpeg','image/png','image/webp'], max: 5*1024*1024, needLocation: true },
  worker_doc: { roles: ['job_seeker'], mime: ['application/pdf','image/jpeg','image/png'], max: 10*1024*1024, needLocation: false },
  company_doc: { roles: ['company','admin'], mime: ['application/pdf','image/jpeg','image/png'], max: 10*1024*1024, needLocation: false },
  company_asset: { roles: ['company','admin'], mime: ['application/pdf','image/jpeg','image/png'], max: 10*1024*1024, needLocation: false },
  contractor_doc: { roles: ['contractor','admin'], mime: ['application/pdf','image/jpeg','image/png'], max: 10*1024*1024, needLocation: false },
  project_doc: { roles: ['contractor','admin'], mime: ['application/pdf','image/jpeg','image/png'], max: 10*1024*1024, needLocation: false },
  site_photo: { roles: ['site_engineer','contractor','admin'], mime: ['image/jpeg','image/png','image/webp'], max: 10*1024*1024, needLocation: true },
  material_receipt: { roles: ['site_engineer','contractor','admin'], mime: ['application/pdf','image/jpeg','image/png'], max: 10*1024*1024, needLocation: false },
  expense_receipt: { roles: ['site_engineer','contractor','admin'], mime: ['application/pdf','image/jpeg','image/png'], max: 10*1024*1024, needLocation: false },
  daily_report_photo: { roles: ['site_engineer','contractor','admin'], mime: ['image/jpeg','image/png','image/webp'], max: 10*1024*1024, needLocation: true },
};

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);
  constructor(
    @InjectRepository(Document) private readonly repo: Repository<Document>,
    private readonly config: ConfigService,
  ) {}

  private isS3Configured() {
    const b = this.config.get<string>('AWS_S3_BUCKET');
    return !!b && b !== 'your-bucket-name';
  }

  private async uploadToS3(key: string, file: any) {
    if (!this.isS3Configured()) return `https://cdn.buildhire.app/${key}`;
    try {
      const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
      const client = new S3Client({
        region: this.config.get<string>('AWS_REGION') ?? 'us-east-1',
        credentials: {
          accessKeyId: this.config.get<string>('AWS_ACCESS_KEY_ID')!,
          secretAccessKey: this.config.get<string>('AWS_SECRET_ACCESS_KEY')!,
        },
      });
      await client.send(new PutObjectCommand({
        Bucket: this.config.get<string>('AWS_S3_BUCKET'),
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }));
      return `https://${this.config.get<string>('AWS_S3_BUCKET')}.s3.amazonaws.com/${key}`;
    } catch (e: any) {
      this.logger.warn(`S3 upload failed, falling back to mock: ${e.message}`);
      return `https://cdn.buildhire.app/${key}`;
    }
  }

  async getPresignedUrl(doc: Document): Promise<string> {
    if (!this.isS3Configured()) return `https://cdn.buildhire.app/${doc.objectKey}`;
    // S3 presign optional — return mock until bucket is real
    return `https://cdn.buildhire.app/${doc.objectKey}`;
  }

  async presign(entityType: string, entityId: string, filename: string, mimeType: string, userId: string) {
    const policy = ALLOWED_TYPES[entityType];
    if (!policy) throw new BadRequestException(`Unknown entityType ${entityType}`);
    const ext = path.extname(filename) || '';
    const key = `documents/${entityType}/${entityId}/${randomUUID()}${ext}`;
    // S3 PUT presign — return mock until bucket is real (keep same shape)
    return { url: `https://cdn.buildhire.app/${key}`, key, method: 'PUT' as const, headers: { 'Content-Type': mimeType } };
  }

  async upload(file: any, userId: string, dto: { entityType: string; entityId: string; latitude?: number; longitude?: number; capturedAt?: string }) {
    const policy = ALLOWED_TYPES[dto.entityType];
    if (!policy) throw new BadRequestException(`Unknown entityType ${dto.entityType}. Allowed: ${Object.keys(ALLOWED_TYPES).join(', ')}`);
    if (file.size > policy.max) throw new BadRequestException(`File too large max ${policy.max/1024/1024}MB`);
    if (!policy.mime.includes(file.mimetype)) throw new BadRequestException(`Invalid mime ${file.mimetype}. Allowed ${policy.mime.join(', ')}`);
    if (policy.needLocation && (dto.latitude == null || dto.longitude == null)) throw new BadRequestException(`${dto.entityType} requires latitude & longitude (live photo)`);
    // role check done in controller via @Roles, but double-check here if needed

    const ext = path.extname(file.originalname) || '';
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `documents/${dto.entityType}/${dto.entityId}/${randomUUID()}-${sanitized}${ext ? '' : ''}`;

    await this.uploadToS3(key, file);

    const doc = this.repo.create({
      entityType: dto.entityType,
      entityId: dto.entityId,
      objectKey: key,
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      ownerId: userId,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
      capturedAt: dto.capturedAt ? new Date(dto.capturedAt) : null,
      verificationStatus: 'pending',
    } as any);

    const savedArr: any = await this.repo.save(doc as any);
    const savedDoc: Document = Array.isArray(savedArr) ? savedArr[0] : savedArr;
    return { ...savedDoc, url: await this.getPresignedUrl(savedDoc) };
  }

  // compat for seeker api.md POST /documents {file, type}
  async uploadCompat(file: any, userId: string, type: string) {
    return this.upload(file, userId, { entityType: type === 'aadhaar' || type === 'experience' || type === 'skill' ? 'worker_doc' : 'worker_doc', entityId: userId });
  }

  async list(userId: string, role: string, query: { entityType?: string; entityId?: string }) {
    const where: any = {};
    if (query.entityType) where.entityType = query.entityType;
    if (query.entityId) where.entityId = query.entityId;
    // non-admin sees only own or scoped — for now return own + admin sees all
    if (role !== 'admin' && !query.entityType) where.ownerId = userId;
    const docs = await this.repo.find({ where, order: { createdAt: 'DESC' }, take: 100 });
    return Promise.all(docs.map(async d => ({ ...d, url: await this.getPresignedUrl(d) })));
  }

  async getOne(id: string, userId: string, role: string) {
    const doc = await this.repo.findOne({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');
    if (role !== 'admin' && doc.ownerId !== userId) throw new ForbiddenException('Not your document');
    return { ...doc, url: await this.getPresignedUrl(doc) };
  }

  async remove(id: string, userId: string, role: string) {
    const doc = await this.repo.findOne({ where: { id } });
    if (!doc) throw new NotFoundException('Document not found');
    if (role !== 'admin' && doc.ownerId !== userId) throw new ForbiddenException('Not your document');
    await this.repo.remove(doc);
    return { deleted: true };
  }
}
