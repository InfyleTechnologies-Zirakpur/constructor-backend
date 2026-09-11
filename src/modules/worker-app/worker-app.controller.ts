import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Patch,
  UseGuards,
  Req,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { WorkerAppService } from './worker-app.service.js';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller()
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class WorkerAppController {
  constructor(private readonly workerAppService: WorkerAppService) {}

  // ════════════════════════════════════════════════════
  //  PROFILE
  // ════════════════════════════════════════════════════

  /**
   * GET /profile — Return the worker profile for the authenticated user.
   */
  @Get('profile')
  @Roles('job_seeker', 'admin', 'contractor', 'site_engineer', 'company')
  async getProfile(@Req() req: any) {
    return this.workerAppService.getWorkerProfile(req.user.id);
  }

  /**
   * PUT /profile — Update the worker profile (partial updates accepted).
   */
  @Put('profile')
  @Roles('job_seeker', 'admin', 'contractor', 'site_engineer', 'company')
  async updateProfile(@Req() req: any, @Body() body: Record<string, any>) {
    return this.workerAppService.updateWorkerProfile(req.user.id, body);
  }

  /**
   * POST /profile/photo — Upload a profile photo (multipart/form-data, field: "photo").
   */
  @Post('profile/photo')
  @Roles('job_seeker', 'admin', 'contractor', 'site_engineer', 'company')
  @UseInterceptors(FileInterceptor('photo'))
  async uploadProfilePhoto(@Req() req: any, @UploadedFile() file: any) {
    return this.workerAppService.uploadProfilePhoto(req.user.id, file);
  }

  // ════════════════════════════════════════════════════
  //  DOCUMENTS
  // ════════════════════════════════════════════════════

  /**
   * POST /documents — Upload a worker document (multipart: file + type).
   */
  @Post('documents')
  @Roles('job_seeker', 'admin', 'contractor', 'site_engineer', 'company')
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(
    @Req() req: any,
    @UploadedFile() file: any,
    @Body('type') type: string,
  ) {
    return this.workerAppService.uploadDocument(req.user.id, file, type);
  }

  /**
   * GET /documents — List user's documents.
   */
  @Get('documents')
  @Roles('job_seeker', 'admin', 'contractor', 'site_engineer', 'company')
  async listDocuments(@Req() req: any) {
    return this.workerAppService.listDocuments(req.user.id);
  }

  // ════════════════════════════════════════════════════
  //  JOBS (Flutter-specific routes)
  // ════════════════════════════════════════════════════

  /**
   * POST /jobs/:jobId/save — Toggle save/unsave a job.
   */
  @Post('jobs/:jobId/save')
  @HttpCode(HttpStatus.OK)
  @Roles('job_seeker')
  async toggleSaveJob(@Req() req: any, @Param('jobId') jobId: string) {
    return this.workerAppService.toggleSaveJob(req.user.id, jobId);
  }

  /**
   * POST /jobs/:jobId/applications — Apply to a job (Flutter route).
   */
  @Post('jobs/:jobId/applications')
  @Roles('job_seeker')
  async applyToJob(
    @Req() req: any,
    @Param('jobId') jobId: string,
    @Body() body: Record<string, any>,
  ) {
    return this.workerAppService.applyToJob(req.user.id, jobId, body);
  }

  // ════════════════════════════════════════════════════
  //  DASHBOARD
  // ════════════════════════════════════════════════════

  /**
   * GET /dashboard — Aggregated worker dashboard stats.
   */
  @Get('dashboard')
  @Roles('job_seeker', 'admin', 'contractor', 'site_engineer', 'company')
  async getDashboard(@Req() req: any) {
    return this.workerAppService.getDashboard(req.user.id);
  }

  // ════════════════════════════════════════════════════
  //  CONVERSATIONS (placeholder for messaging)
  // ════════════════════════════════════════════════════

  /**
   * GET /conversations — List conversations.
   */
  @Get('conversations')
  @Roles('job_seeker', 'admin', 'contractor', 'site_engineer', 'company')
  async listConversations(@Req() req: any) {
    return this.workerAppService.listConversations(req.user.id);
  }

  /**
   * POST /conversations/:conversationId/messages — Send a message.
   */
  @Post('conversations/:conversationId/messages')
  @Roles('job_seeker', 'admin', 'contractor', 'site_engineer', 'company')
  async sendMessage(
    @Req() req: any,
    @Param('conversationId') conversationId: string,
    @Body('text') text: string,
  ) {
    return this.workerAppService.sendMessage(req.user.id, conversationId, text);
  }

  // ════════════════════════════════════════════════════
  //  NOTIFICATIONS (Flutter-specific routes)
  // ════════════════════════════════════════════════════

  /**
   * GET /notifications — List notifications for Flutter app.
   * (This overrides the existing /notifications route for mobile app compat.)
   */
  @Get('notifications')
  @Roles('job_seeker', 'admin', 'contractor', 'site_engineer', 'company')
  async listNotifications(@Req() req: any) {
    return this.workerAppService.listNotifications(req.user.id);
  }

  /**
   * PATCH /notifications/:id — Mark notification as read.
   * Flutter sends: { "isRead": true }
   */
  @Patch('notifications/:id')
  @Roles('job_seeker', 'admin', 'contractor', 'site_engineer', 'company')
  async markNotificationRead(@Req() req: any, @Param('id') id: string) {
    return this.workerAppService.markNotificationRead(req.user.id, id);
  }
}
