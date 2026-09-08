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
import { ApplicationsService } from './applications.service.js';
import { CreateApplicationDto } from './dto/create-applications.dto.js';
import { UpdateApplicationStatusDto } from './dto/update-applications.dto.js';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';

@Controller('applications')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ApplicationsController {
  constructor(private readonly applicationsService: ApplicationsService) {}

  /**
   * POST /jobs/:jobId/applications — Job Seeker applies to a job.
   * (This route is also mounted via the Jobs controller prefix.)
   */
  @Post('/jobs/:jobId/apply')
  @Roles('job_seeker')
  async apply(
    @Req() req: any,
    @Param('jobId') jobId: string,
    @Body() dto: CreateApplicationDto,
  ) {
    const application = await this.applicationsService.apply(
      jobId,
      req.user.id,
      dto,
    );
    return { message: 'Application submitted successfully', data: application };
  }

  /**
   * GET /applications — List applications.
   * - Job Seeker: their own applications.
   * - Company: applications for their jobs.
   * - Admin: all applications.
   */
  @Get()
  @Roles('admin', 'company', 'job_seeker')
  async list(
    @Req() req: any,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('status') status?: string,
  ) {
    return this.applicationsService.list(
      req.user.role,
      req.user.id,
      Number(page),
      Number(limit),
      status,
    );
  }

  /**
   * GET /applications/:id — Get a single application.
   */
  @Get(':id')
  @Roles('admin', 'company', 'job_seeker')
  async getById(@Req() req: any, @Param('id') id: string) {
    const application = await this.applicationsService.getById(
      id,
      req.user.role,
      req.user.id,
    );
    return { data: application };
  }

  /**
   * PATCH /applications/:id/status — Company or Admin updates application status.
   */
  @Patch(':id/status')
  @Roles('admin', 'company')
  async updateStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateApplicationStatusDto,
  ) {
    const application = await this.applicationsService.updateStatus(
      id,
      req.user.id,
      req.user.role,
      dto,
    );
    return { message: 'Application status updated', data: application };
  }

  /**
   * POST /applications/bulk-shortlist — Company or Admin shortlists multiple applications.
   */
  @Post('bulk-shortlist')
  @Roles('admin', 'company')
  async bulkShortlist(
    @Req() req: any,
    @Body() body: { applicationIds: string[] },
  ) {
    const result = await this.applicationsService.bulkShortlist(
      body.applicationIds,
      req.user.id,
      req.user.role,
    );
    return {
      message: `${result.updated} applications shortlisted`,
      data: result,
    };
  }

  /**
   * POST /applications/:id/withdraw — Job Seeker withdraws their application.
   */
  @Post(':id/withdraw')
  @Roles('job_seeker')
  async withdraw(@Req() req: any, @Param('id') id: string) {
    const application = await this.applicationsService.withdraw(
      id,
      req.user.id,
    );
    return { message: 'Application withdrawn', data: application };
  }
}
