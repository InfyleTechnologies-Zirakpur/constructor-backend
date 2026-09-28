import { Body, Controller, Param, Post, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { SitesService } from './sites.service.js';

/**
 * Legacy routes kept for backward compatibility.
 * Primary site-level operations are handled in ProjectSitesController and AttendanceController.
 * All routes require JWT authentication and appropriate role assignment.
 */
@Controller('sites')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class SitesController {
  constructor(private readonly sitesService: SitesService) {}

  @Post(':id/attendance/check-in')
  @Roles('site_engineer', 'contractor', 'admin')
  async checkIn(@Req() req: any, @Param('id') id: string, @Body() dto: any) {
    return this.sitesService.checkIn(id, { ...dto, userId: req.user.id });
  }

  @Post(':id/daily-reports')
  @Roles('site_engineer', 'contractor', 'admin')
  async createDailyReport(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: any,
  ) {
    return this.sitesService.createDailyReport(id, {
      ...dto,
      userId: req.user.id,
    });
  }
}
