import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ReportsService } from './reports.service.js';
import { CreateDailyReportDto } from './dto/create-reports.dto.js';
import { UpdateReportStatusDto } from './dto/update-reports.dto.js';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';

@Controller()
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  /**
   * POST /sites/:siteId/daily-reports — Create a daily report.
   * Cost fields are calculated server-side from attendance, materials, expenses.
   */
  @Post('sites/:siteId/daily-reports')
  @Roles('admin', 'contractor', 'site_engineer')
  async createDailyReport(
    @Req() req: any,
    @Param('siteId') siteId: string,
    @Body() dto: CreateDailyReportDto,
  ) {
    const report = await this.reportsService.createDailyReport(
      siteId,
      req.user.id,
      req.user.role,
      dto,
    );
    return {
      success: true,
      message: 'Daily report created',
      data: report,
    };
  }

  /**
   * PATCH /reports/:id/status — Submit or review a daily report.
   */
  @Patch('reports/:id/status')
  @Roles('admin', 'contractor', 'site_engineer')
  async updateReportStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateReportStatusDto,
  ) {
    const report = await this.reportsService.updateReportStatus(
      id,
      req.user.id,
      req.user.role,
      dto,
    );
    return {
      success: true,
      message: `Report ${dto.status}`,
      data: report,
    };
  }

  /**
   * GET /reports/:id — Get a single daily report.
   */
  @Get('reports/:id')
  @Roles('admin', 'contractor', 'site_engineer')
  async getReport(@Param('id') id: string) {
    const report = await this.reportsService.getReportById(id);
    return { success: true, data: report };
  }

  /**
   * GET /sites/:siteId/daily-reports — List daily reports for a site.
   */
  @Get('sites/:siteId/daily-reports')
  @Roles('admin', 'contractor', 'site_engineer')
  async listSiteReports(
    @Param('siteId') siteId: string,
    @Query('status') status?: string,
  ) {
    const result = await this.reportsService.listSiteReports(siteId, status);
    return { success: true, data: result };
  }

  /**
   * GET /projects/:projectId/reports — List all reports for a project with cost/profit summary.
   */
  @Get('projects/:projectId/reports')
  @Roles('admin', 'contractor')
  async listProjectReports(
    @Param('projectId') projectId: string,
    @Query('status') status?: string,
  ) {
    const result = await this.reportsService.listProjectReports(
      projectId,
      status,
    );
    return { success: true, data: result };
  }
}
