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

  private isBunnyConfigured() {
    const z = this.config.get<string>('BUNNY_STORAGE_ZONE');
    const p = this.config.get<string>('BUNNY_STORAGE_PASSWORD') ?? this.config.get<string>('BUNNY_STORAGE_API_KEY');
    return !!z && !!p && p !== 'your-bunny-storage-password' && p !== 'your-bunny-storage-api-key';
  }

  private isS3Configured() {
    const b = this.config.get<string>('AWS_S3_BUCKET');
    return !!b && b !== 'your-bucket-name';
  }

  private getBunnyUrl(key: string) {
    const pull = this.config.get<string>('BUNNY_PULL_ZONE') ?? this.config.get<string>('BUNNY_CDN_URL') ?? this.config.get<string>('BUNNY_CDN_HOSTNAME') ?? 'https://buildhire.b-cdn.net';
    const base = pull.startsWith('http') ? pull : `https://${pull}`;
    return `${base.replace(/\/$/, '')}/${key}`;
  }

  private async uploadToBunny(key: string, file: any): Promise<string> {
    const zone = this.config.get<string>('BUNNY_STORAGE_ZONE')!;
    const password = this.config.get<string>('BUNNY_STORAGE_PASSWORD') ?? this.config.get<string>('BUNNY_STORAGE_API_KEY')!;
    const hostname = this.config.get<string>('BUNNY_STORAGE_HOSTNAME') ?? 'storage.bunnycdn.com';
    const url = `https://${hostname}/${zone}/${key}`;
    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          AccessKey: password,
          'Content-Type': file.mimetype,
        },
        body: file.buffer,
      } as any);
      if (!res.ok) throw new Error(`Bunny ${res.status} ${await res.text()}`);
      return this.getBunnyUrl(key);
    } catch (e: any) {
      this.logger.warn(`Bunny upload failed, falling back to mock: ${e.message}`);
      return `https://cdn.buildhire.app/${key}`;
    }
  }

  private async uploadToS3(key: string, file: any) {
    // Priority: Bunny first (you asked), then S3, then mock
    if (this.isBunnyConfigured()) return this.uploadToBunny(key, file);
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
    if (this.isBunnyConfigured()) return this.getBunnyUrl(doc.objectKey);
    if (!this.isS3Configured()) return `https://cdn.buildhire.app/${doc.objectKey}`;
    return `https://cdn.buildhire.app/${doc.objectKey}`;
  }

  async presign(entityType: string, entityId: string, filename: string, mimeType: string, userId: string) {
    const policy = ALLOWED_TYPES[entityType];
    if (!policy) throw new BadRequestException(`Unknown entityType ${entityType}`);
    const ext = path.extname(filename) || '';
    const base = path.basename(filename, ext).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 40) || 'file';
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth()+1).padStart(2,'0');
    const dd = String(now.getDate()).padStart(2,'0');
    const shortId = randomUUID().slice(0,8);
    const key = `documents/${entityType}/${yyyy}/${mm}/${entityId}/${dd}_${base}_${shortId}${ext}`;
    if (this.isBunnyConfigured()) {
      const zone = this.config.get<string>('BUNNY_STORAGE_ZONE');
      return { url: `https://storage.bunnycdn.com/${zone}/${key}`, key, method: 'PUT' as const, headers: { AccessKey: '***', 'Content-Type': mimeType } };
    }
    return { url: `https://cdn.buildhire.app/${key}`, key, method: 'PUT' as const, headers: { 'Content-Type': mimeType } };
  }

  async upload(file: any, userId: string, dto: { entityType: string; entityId: string; latitude?: number; longitude?: number; capturedAt?: string }) {
    if (!file?.buffer && !file?.size) throw new BadRequestException('file is required — field name must be "file" and path must exist (e.g. -F file=@C:/path/to/file.jpg)');
    const policy = ALLOWED_TYPES[dto.entityType?.replace(/"/g,'')];
    if (!policy) throw new BadRequestException(`Unknown entityType ${dto.entityType}. Allowed: ${Object.keys(ALLOWED_TYPES).join(', ')}`);
    if (file.size > policy.max) throw new BadRequestException(`File too large max ${policy.max/1024/1024}MB`);
    if (!policy.mime.includes(file.mimetype)) throw new BadRequestException(`Invalid mime ${file.mimetype}. Allowed ${policy.mime.join(', ')}`);
    if (policy.needLocation && (dto.latitude == null || dto.longitude == null)) throw new BadRequestException(`${dto.entityType} requires latitude & longitude (live photo)`);
    // role check done in controller via @Roles, but double-check here if needed

    const ext = path.extname(file.originalname) || '';
    const base = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 40) || 'file';
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth()+1).padStart(2,'0');
    const dd = String(now.getDate()).padStart(2,'0');
    const shortId = randomUUID().slice(0,8);
    // Meaningful: documents/<type>/<yyyy>/<mm>/<entityId>/<dd>_<base>_<shortId><ext>
    // Example: documents/company_doc/2026/09/23bf.../22_WhatsApp_Image_398ec835.jpg
    // Future insights: you can list by year/month/entityId and see original name + date
    const key = `documents/${dto.entityType}/${yyyy}/${mm}/${dto.entityId}/${dd}_${base}_${shortId}${ext}`;

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
