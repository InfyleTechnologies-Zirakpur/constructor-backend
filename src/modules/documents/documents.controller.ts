import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { DocumentsService } from './documents.service.js';

@Controller('documents')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class DocumentsController {
  constructor(private readonly docs: DocumentsService) {}

  // Seeker compat: POST /documents {file, type} api.md:389
  @Post()
  @Roles('job_seeker','company','contractor','site_engineer','admin')
  @UseInterceptors(FileInterceptor('file'))
  async uploadCompat(@Req() req: any, @UploadedFile() file: any, @Body('type') type: string) {
    return this.docs.uploadCompat(file, req.user.id, type ?? 'worker_doc');
  }

  // Global: POST /documents/upload — all roles, live photo + location
  @Post('upload')
  @Roles('job_seeker','company','contractor','site_engineer','admin')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @Req() req: any,
    @UploadedFile() file: any,
    @Body('entityType') entityType: string,
    @Body('entityId') entityId: string,
    @Body('latitude') latitude?: string,
    @Body('longitude') longitude?: string,
    @Body('capturedAt') capturedAt?: string,
  ) {
    return this.docs.upload(file, req.user.id, {
      entityType,
      entityId,
      latitude: latitude ? parseFloat(latitude) : undefined,
      longitude: longitude ? parseFloat(longitude) : undefined,
      capturedAt,
    });
  }

  @Post('presign')
  @Roles('job_seeker','company','contractor','site_engineer','admin')
  async presign(
    @Req() req: any,
    @Body('entityType') entityType: string,
    @Body('entityId') entityId: string,
    @Body('filename') filename: string,
    @Body('mimeType') mimeType: string,
  ) {
    return this.docs.presign(entityType, entityId, filename, mimeType, req.user.id);
  }

  @Get()
  @Roles('job_seeker','company','contractor','site_engineer','admin')
  async list(@Req() req: any, @Query('entityType') entityType?: string, @Query('entityId') entityId?: string) {
    return this.docs.list(req.user.id, req.user.role, { entityType, entityId });
  }

  @Get(':id')
  @Roles('job_seeker','company','contractor','site_engineer','admin')
  async getOne(@Req() req: any, @Param('id') id: string) {
    return this.docs.getOne(id, req.user.id, req.user.role);
  }

  @Get(':id/url')
  @Roles('job_seeker','company','contractor','site_engineer','admin')
  async getUrl(@Req() req: any, @Param('id') id: string) {
    const doc = await this.docs.getOne(id, req.user.id, req.user.role);
    return { url: (doc as any).url };
  }

  @Delete(':id')
  @Roles('job_seeker','company','contractor','site_engineer','admin')
  async remove(@Req() req: any, @Param('id') id: string) {
    return this.docs.remove(id, req.user.id, req.user.role);
  }
}
