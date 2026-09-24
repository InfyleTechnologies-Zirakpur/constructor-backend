import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { AuditLogsService } from './audit-logs.service.js';
import { CreateAuditLogDto } from './dto/create-audit-logs.dto.js';

@Controller('audit-logs')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Post()
  @Roles('admin', 'contractor', 'company')
  async create(@Req() req: any, @Body() dto: CreateAuditLogDto) {
    const log = await this.auditLogsService.create(req.user.id, dto);
    return { message: 'Audit log created', data: log };
  }

  @Get()
  @Roles('admin')
  async list(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('entityType') entityType?: string,
    @Query('actorId') actorId?: string,
  ) {
    return this.auditLogsService.list(Number(page), Number(limit), entityType, actorId);
  }

  @Get(':id')
  @Roles('admin')
  async getById(@Param('id') id: string) {
    return this.auditLogsService.getById(id);
  }
}
