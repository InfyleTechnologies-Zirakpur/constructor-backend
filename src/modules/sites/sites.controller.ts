import { Body, Controller, Param, Post } from '@nestjs/common';
import { SitesService } from './sites.service.js';

@Controller('sites')
export class SitesController {
  constructor(private readonly sitesService: SitesService) {}

  @Post(':id/attendance/check-in')
  async checkIn(@Param('id') id: string, @Body() dto: any) {
    return this.sitesService.checkIn(id, dto);
  }

  @Post(':id/daily-reports')
  async createDailyReport(@Param('id') id: string, @Body() dto: any) {
    return this.sitesService.createDailyReport(id, dto);
  }
}
