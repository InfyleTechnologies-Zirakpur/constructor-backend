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
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ReportsService } from './reports.service.js';
import { CreateDailyReportDto } from './dto/create-reports.dto.js';
import { UpdateReportStatusDto } from './dto/update-reports.dto.js';
import {
  CreateExportDto,
  FinancialReportQueryDto,
  OperationalReportQueryDto,
  ProjectReportQueryDto,
  SiteReportQueryDto,
} from './dto/report-query.dto.js';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';

@Controller()
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // ═══════════════════════════════════════════════════
  //  DAILY REPORTS LIFECYCLE (Maintained)
  // ═══════════════════════════════════════════════════

  /**
   * POST /sites/:siteId/daily-reports — Create a daily report.
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
  async getReport(@Req() req: any, @Param('id') id: string) {
    const report = await this.reportsService.getReportById(
      id,
      req.user.id,
      req.user.role,
    );
    return { success: true, data: report };
  }

  /**
   * GET /sites/:siteId/daily-reports — List daily reports for a site.
   */
  @Get('sites/:siteId/daily-reports')
  @Roles('admin', 'contractor', 'site_engineer')
  async listSiteReports(
    @Req() req: any,
    @Param('siteId') siteId: string,
    @Query() query: SiteReportQueryDto,
  ) {
    const result = await this.reportsService.getSiteDailyReports(
      siteId,
      req.user.id,
      req.user.role,
      query,
    );
    return { success: true, data: result };
  }

  /**
   * GET /projects/:projectId/reports — List all reports for a project with cost/profit summary.
   */
  @Get('projects/:projectId/reports')
  @Roles('admin', 'contractor')
  async listProjectReports(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Query('status') status?: string,
  ) {
    const result = await this.reportsService.listProjectReports(
      projectId,
      req.user.id,
      req.user.role,
      status,
    );
    return { success: true, data: result };
  }

  // ═══════════════════════════════════════════════════
  //  1. PROJECT REPORTS
  // ═══════════════════════════════════════════════════

  /**
   * GET /reports/projects/:projectId/summary — Project summary report.
   */
  @Get('reports/projects/:projectId/summary')
  @Roles('admin', 'contractor')
  async getProjectSummary(
    @Req() req: any,
    @Param('projectId') projectId: string,
  ) {
    const data = await this.reportsService.getProjectSummary(
      projectId,
      req.user.id,
      req.user.role,
    );
    return { success: true, data };
  }

  /**
   * GET /reports/projects/:projectId/progress — Project progress tracking.
   */
  @Get('reports/projects/:projectId/progress')
  @Roles('admin', 'contractor')
  async getProjectProgress(
    @Req() req: any,
    @Param('projectId') projectId: string,
  ) {
    const data = await this.reportsService.getProjectProgress(
      projectId,
      req.user.id,
      req.user.role,
    );
    return { success: true, data };
  }

  /**
   * GET /reports/projects/:projectId/cost — Project cost vs budget breakdown.
   */
  @Get('reports/projects/:projectId/cost')
  @Roles('admin', 'contractor')
  async getProjectCost(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Query() query: ProjectReportQueryDto,
  ) {
    const data = await this.reportsService.getProjectCost(
      projectId,
      req.user.id,
      req.user.role,
      query,
    );
    return { success: true, data };
  }

  /**
   * GET /reports/projects/:projectId/labour-cost — Project labour costs by trades and dates.
   */
  @Get('reports/projects/:projectId/labour-cost')
  @Roles('admin', 'contractor')
  async getProjectLabourCost(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Query() query: ProjectReportQueryDto,
  ) {
    const data = await this.reportsService.getProjectLabourCost(
      projectId,
      req.user.id,
      req.user.role,
      query,
    );
    return { success: true, data };
  }

  /**
   * GET /reports/projects/:projectId/material-cost — Project material purchases & consumption.
   */
  @Get('reports/projects/:projectId/material-cost')
  @Roles('admin', 'contractor')
  async getProjectMaterialCost(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Query() query: ProjectReportQueryDto,
  ) {
    const data = await this.reportsService.getProjectMaterialCost(
      projectId,
      req.user.id,
      req.user.role,
      query,
    );
    return { success: true, data };
  }

  /**
   * GET /reports/projects/:projectId/expenses — Project expenses by category.
   */
  @Get('reports/projects/:projectId/expenses')
  @Roles('admin', 'contractor')
  async getProjectExpenses(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Query() query: ProjectReportQueryDto,
  ) {
    const data = await this.reportsService.getProjectExpenses(
      projectId,
      req.user.id,
      req.user.role,
      query,
    );
    return { success: true, data };
  }

  /**
   * GET /reports/projects/:projectId/profitability — Project profitability analysis.
   */
  @Get('reports/projects/:projectId/profitability')
  @Roles('admin', 'contractor')
  async getProjectProfitability(
    @Req() req: any,
    @Param('projectId') projectId: string,
  ) {
    const data = await this.reportsService.getProjectProfitability(
      projectId,
      req.user.id,
      req.user.role,
    );
    return { success: true, data };
  }

  /**
   * GET /reports/projects/:projectId/daily-reports — Filterable daily project reports.
   */
  @Get('reports/projects/:projectId/daily-reports')
  @Roles('admin', 'contractor')
  async getProjectDailyReports(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Query() query: ProjectReportQueryDto,
  ) {
    const data = await this.reportsService.getProjectDailyReports(
      projectId,
      req.user.id,
      req.user.role,
      query,
    );
    return { success: true, data };
  }

  // ═══════════════════════════════════════════════════
  //  2. SITE REPORTS
  // ═══════════════════════════════════════════════════

  /**
   * GET /reports/sites/:siteId/labour — Site labour & workforce report.
   */
  @Get('reports/sites/:siteId/labour')
  @Roles('admin', 'contractor', 'site_engineer')
  async getSiteLabourReport(
    @Req() req: any,
    @Param('siteId') siteId: string,
    @Query() query: SiteReportQueryDto,
  ) {
    const data = await this.reportsService.getSiteLabourReport(
      siteId,
      req.user.id,
      req.user.role,
      query,
    );
    return { success: true, data };
  }

  /**
   * GET /reports/sites/:siteId/materials — Site material movement & stock balance.
   */
  @Get('reports/sites/:siteId/materials')
  @Roles('admin', 'contractor', 'site_engineer')
  async getSiteMaterialReport(
    @Req() req: any,
    @Param('siteId') siteId: string,
    @Query() query: SiteReportQueryDto,
  ) {
    const data = await this.reportsService.getSiteMaterialReport(
      siteId,
      req.user.id,
      req.user.role,
      query,
    );
    return { success: true, data };
  }

  /**
   * GET /reports/sites/:siteId/expenses — Site expense details and categories.
   */
  @Get('reports/sites/:siteId/expenses')
  @Roles('admin', 'contractor', 'site_engineer')
  async getSiteExpenseReport(
    @Req() req: any,
    @Param('siteId') siteId: string,
    @Query() query: SiteReportQueryDto,
  ) {
    const data = await this.reportsService.getSiteExpenseReport(
      siteId,
      req.user.id,
      req.user.role,
      query,
    );
    return { success: true, data };
  }

  /**
   * GET /reports/sites/:siteId/progress — Site progress curve & recent work.
   */
  @Get('reports/sites/:siteId/progress')
  @Roles('admin', 'contractor', 'site_engineer')
  async getSiteProgressReport(
    @Req() req: any,
    @Param('siteId') siteId: string,
    @Query() query: SiteReportQueryDto,
  ) {
    const data = await this.reportsService.getSiteProgressReport(
      siteId,
      req.user.id,
      req.user.role,
      query,
    );
    return { success: true, data };
  }

  // ═══════════════════════════════════════════════════
  //  3. OPERATIONAL REPORTS
  // ═══════════════════════════════════════════════════

  /**
   * GET /reports/operations/attendance — Platform/Contractor attendance report.
   */
  @Get('reports/operations/attendance')
  @Roles('admin', 'contractor')
  async getAttendanceReport(
    @Req() req: any,
    @Query() query: OperationalReportQueryDto,
  ) {
    const data = await this.reportsService.getAttendanceReport(
      req.user.id,
      req.user.role,
      query,
    );
    return { success: true, data };
  }

  /**
   * GET /reports/operations/contractors — Contractor portfolio report.
   */
  @Get('reports/operations/contractors')
  @Roles('admin', 'contractor')
  async getContractorReport(
    @Req() req: any,
    @Query() query: OperationalReportQueryDto,
  ) {
    const data = await this.reportsService.getContractorReport(
      req.user.id,
      req.user.role,
      query,
    );
    return { success: true, data };
  }

  /**
   * GET /reports/operations/users — Admin user distribution report.
   */
  @Get('reports/operations/users')
  @Roles('admin')
  async getUserReport(
    @Req() req: any,
    @Query() query: OperationalReportQueryDto,
  ) {
    const data = await this.reportsService.getUserReport(
      req.user.id,
      req.user.role,
      query,
    );
    return { success: true, data };
  }

  /**
   * GET /reports/operations/companies — Admin company verification report.
   */
  @Get('reports/operations/companies')
  @Roles('admin')
  async getCompanyReport(
    @Req() req: any,
    @Query() query: OperationalReportQueryDto,
  ) {
    const data = await this.reportsService.getCompanyReport(
      req.user.id,
      req.user.role,
      query,
    );
    return { success: true, data };
  }

  /**
   * GET /reports/operations/jobs-applications — Jobs & Applications funnel report.
   */
  @Get('reports/operations/jobs-applications')
  @Roles('admin', 'company')
  async getJobApplicationReport(
    @Req() req: any,
    @Query() query: OperationalReportQueryDto,
  ) {
    const data = await this.reportsService.getJobApplicationReport(
      req.user.id,
      req.user.role,
      query,
    );
    return { success: true, data };
  }

  // ═══════════════════════════════════════════════════
  //  4. FINANCIAL REPORTS
  // ═══════════════════════════════════════════════════

  /**
   * GET /reports/financial/costs — Cross-project cost analytics.
   */
  @Get('reports/financial/costs')
  @Roles('admin', 'contractor')
  async getFinancialCostReport(
    @Req() req: any,
    @Query() query: FinancialReportQueryDto,
  ) {
    const data = await this.reportsService.getFinancialCostReport(
      req.user.id,
      req.user.role,
      query,
    );
    return { success: true, data };
  }

  /**
   * GET /reports/financial/profitability — Cross-project profitability rankings.
   */
  @Get('reports/financial/profitability')
  @Roles('admin', 'contractor')
  async getFinancialProfitabilityReport(
    @Req() req: any,
    @Query() query: FinancialReportQueryDto,
  ) {
    const data = await this.reportsService.getFinancialProfitabilityReport(
      req.user.id,
      req.user.role,
      query,
    );
    return { success: true, data };
  }

  // ═══════════════════════════════════════════════════
  //  5. EXPORT FUNCTIONALITY (PDF, Excel, CSV)
  // ═══════════════════════════════════════════════════

  /**
   * POST /reports/export — Create an asynchronous report export job.
   */
  @Post('reports/export')
  @Roles('admin', 'contractor', 'site_engineer')
  async createExport(@Req() req: any, @Body() dto: CreateExportDto) {
    const exportJob = await this.reportsService.createExport(
      req.user.id,
      req.user.role,
      dto,
    );
    return {
      success: true,
      message: 'Export request created',
      data: exportJob,
    };
  }

  /**
   * GET /reports/export — List user's export requests.
   */
  @Get('reports/export')
  @Roles('admin', 'contractor', 'site_engineer')
  async listExports(@Req() req: any) {
    const exportsList = await this.reportsService.listExports(req.user.id);
    return { success: true, data: exportsList };
  }

  /**
   * GET /reports/export/:id — Check export status.
   */
  @Get('reports/export/:id')
  @Roles('admin', 'contractor', 'site_engineer')
  async getExportStatus(@Req() req: any, @Param('id') id: string) {
    const exportJob = await this.reportsService.getExportStatus(
      id,
      req.user.id,
    );
    return { success: true, data: exportJob };
  }

  /**
   * GET /reports/export/:id/download — Download completed export file.
   */
  @Get('reports/export/:id/download')
  @Roles('admin', 'contractor', 'site_engineer')
  async downloadExport(
    @Req() req: any,
    @Res() res: Response,
    @Param('id') id: string,
  ) {
    const file = await this.reportsService.downloadExport(id, req.user.id);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.fileName}"`,
    );
    return res.send(file.content);
  }

  /**
   * GET /reports/export/download — Direct streaming export download.
   */
  @Get('reports/export/download')
  @Roles('admin', 'contractor', 'site_engineer')
  async directExportDownload(
    @Req() req: any,
    @Res() res: Response,
    @Query('reportType') reportType: string,
    @Query('format') format = 'csv',
    @Query() filters: Record<string, any>,
  ) {
    const file = await this.reportsService.exportReportDirect(
      reportType,
      format,
      filters,
      req.user.id,
      req.user.role,
    );
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.fileName}"`,
    );
    return res.send(file.content);
  }
}
