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
import { AdminSendNotificationDto } from './dto/notification-job.dto.js';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { Throttle } from '@nestjs/throttler';

@Controller('notifications')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // ─── DEVICE TOKEN MANAGEMENT ──────────────────────

  /**
   * POST /notifications/register-device — Register an FCM device token.
   * Rate limited to 10 requests per minute.
   */
  @Post('register-device')
  @Roles('admin', 'contractor', 'site_engineer', 'job_seeker', 'company')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
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
   * Rate limited to 10 requests per minute.
   */
  @Delete('unregister-device')
  @Roles('admin', 'contractor', 'site_engineer', 'job_seeker', 'company')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async unregisterDevice(@Req() req: any, @Body('token') token: string) {
    await this.notificationsService.unregisterDevice(req.user.id, token);
    return {
      success: true,
      message: 'Device unregistered',
    };
  }

  // ─── ADMIN NOTIFICATION MANAGEMENT ────────────────

  /**
   * GET /notifications/admin — List all notifications across platform with recipient user data.
   * Rate limited to 12 requests per minute.
   */
  @Get('admin')
  @Roles('admin')
  @Throttle({ default: { ttl: 60000, limit: 12 } })
  async listAdminNotifications(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('event') event?: string,
    @Query('userId') userId?: string,
    @Query('search') search?: string,
  ) {
    const result = await this.notificationsService.listAdminNotifications(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      event,
      userId,
      search,
    );
    return { success: true, data: result };
  }

  /**
   * POST /notifications/send — Send notification or broadcast announcement (admin).
   * Rate limited to 12 requests per minute.
   */
  @Post('send')
  @Roles('admin')
  @Throttle({ default: { ttl: 60000, limit: 12 } })
  async sendNotification(@Body() dto: AdminSendNotificationDto) {
    const res = await this.notificationsService.sendAdminNotification(dto);
    return {
      success: true,
      message: `Notification dispatched to ${res.count} user(s)`,
      data: { count: res.count },
    };
  }

  // ─── USER NOTIFICATIONS ───────────────────────────

  /**
   * GET /notifications — List notifications.
   * If caller is admin and ?all=true is passed, returns admin list with user relations.
   * Otherwise returns current user's notifications.
   * Rate limited to 12 requests per minute.
   */
  @Get()
  @Roles('admin', 'contractor', 'site_engineer', 'job_seeker', 'company')
  @Throttle({ default: { ttl: 60000, limit: 12 } })
  async listNotifications(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('all') all?: string,
    @Query('event') event?: string,
    @Query('search') search?: string,
  ) {
    if (req.user?.role === 'admin' && all === 'true') {
      const result = await this.notificationsService.listAdminNotifications(
        page ? parseInt(page, 10) : 1,
        limit ? parseInt(limit, 10) : 20,
        event,
        undefined,
        search,
      );
      return { success: true, data: result };
    }

    const result = await this.notificationsService.listUserNotifications(
      req.user.id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
    return { success: true, data: result };
  }

  /**
   * PATCH /notifications/:id/read — Mark a notification as read.
   * Rate limited to 12 requests per minute.
   */
  @Patch(':id/read')
  @Roles('admin', 'contractor', 'site_engineer', 'job_seeker', 'company')
  @Throttle({ default: { ttl: 60000, limit: 12 } })
  async markAsRead(@Req() req: any, @Param('id') id: string) {
    await this.notificationsService.markAsRead(
      id,
      req.user.role === 'admin' ? undefined : req.user.id,
    );
    return { success: true, message: 'Notification marked as read' };
  }

  /**
   * PATCH /notifications/read-all — Mark all notifications as read.
   * Rate limited to 10 requests per minute.
   */
  @Patch('read-all')
  @Roles('admin', 'contractor', 'site_engineer', 'job_seeker', 'company')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async markAllAsRead(@Req() req: any) {
    await this.notificationsService.markAllAsRead(req.user.id);
    return { success: true, message: 'All notifications marked as read' };
  }
}
