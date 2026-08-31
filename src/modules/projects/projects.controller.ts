import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ProjectsService } from './projects.service.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';

@Controller('projects')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @Roles('admin', 'contractor')
  async createProject(@Body() dto: any) {
    return this.projectsService.createProject(dto);
  }

  @Post(':id/sites')
  @Roles('admin', 'contractor')
  async createSite(@Param('id') id: string, @Body() dto: any) {
    return this.projectsService.createSite(id, dto);
  }
}
