import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service.js';
import { RegisterDeviceDto } from './dto/create-notifications.dto.js';
import { SendNotificationDto } from './dto/update-notifications.dto.js';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';

@Controller('notifications')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // ─── DEVICE TOKEN MANAGEMENT ──────────────────────

  /**
   * POST /notifications/register-device — Register an FCM device token.
   */
  @Post('register-device')
  @Roles('admin', 'contractor', 'site_engineer', 'job_seeker', 'company')
  async registerDevice(@Req() req: any, @Body() dto: RegisterDeviceDto) {
    const device = await this.notificationsService.registerDevice(
      req.user.id,
      dto,
    );
    return {
      success: true,
      message: 'Device registered for push notifications',
      data: device,
    };
  }

  /**
   * DELETE /notifications/unregister-device — Unregister a device token (on logout).
   */
  @Delete('unregister-device')
  @Roles('admin', 'contractor', 'site_engineer', 'job_seeker', 'company')
  async unregisterDevice(@Req() req: any, @Body('token') token: string) {
    await this.notificationsService.unregisterDevice(req.user.id, token);
    return {
      success: true,
      message: 'Device unregistered',
    };
  }

  // ─── SEND NOTIFICATIONS ───────────────────────────

  /**
   * POST /notifications/send — Send a push notification (admin/system).
   */
  @Post('send')
  @Roles('admin')
  async sendNotification(@Body() dto: SendNotificationDto) {
    const notifications = await this.notificationsService.sendNotification(dto);
    return {
      success: true,
      message: `Notification sent to ${notifications.length} users`,
      data: { count: notifications.length },
    };
  }

  // ─── USER NOTIFICATIONS ───────────────────────────

  /**
   * GET /notifications — List current user's notifications.
   */
  @Get()
  @Roles('admin', 'contractor', 'site_engineer', 'job_seeker', 'company')
  async listNotifications(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const result = await this.notificationsService.listUserNotifications(
      req.user.id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
    return { success: true, data: result };
  }

  /**
   * PATCH /notifications/:id/read — Mark a notification as read.
   */
  @Patch(':id/read')
  @Roles('admin', 'contractor', 'site_engineer', 'job_seeker', 'company')
  async markAsRead(@Req() req: any, @Param('id') id: string) {
    await this.notificationsService.markAsRead(id, req.user.id);
    return { success: true, message: 'Notification marked as read' };
  }

  /**
   * PATCH /notifications/read-all — Mark all notifications as read.
   */
  @Patch('read-all')
  @Roles('admin', 'contractor', 'site_engineer', 'job_seeker', 'company')
  async markAllAsRead(@Req() req: any) {
    await this.notificationsService.markAllAsRead(req.user.id);
    return { success: true, message: 'All notifications marked as read' };
  }
}
