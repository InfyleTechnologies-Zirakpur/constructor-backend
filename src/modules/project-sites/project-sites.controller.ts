import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  Delete,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ProjectSitesService } from './project-sites.service.js';
import { CreateProjectSiteDto } from './dto/create-project-sites.dto.js';
import { UpdateProjectSiteDto } from './dto/update-project-sites.dto.js';
import { AssignEngineerDto } from './dto/assign-engineer.dto.js';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';

@Controller()
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ProjectSitesController {
  constructor(private readonly projectSitesService: ProjectSitesService) {}

  /**
   * POST /projects/:projectId/sites — Create a site under a project.
   */
  @Post('projects/:projectId/sites')
  @Roles('contractor', 'admin')
  async create(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Body() dto: CreateProjectSiteDto,
  ) {
    const site = await this.projectSitesService.create(
      projectId,
      req.user.id,
      dto,
    );
    return { message: 'Site created successfully', data: site };
  }

  /**
   * GET /projects/:projectId/sites — List all sites for a project.
   */
  @Get('projects/:projectId/sites')
  @Roles('contractor', 'admin')
  async findByProject(@Req() req: any, @Param('projectId') projectId: string) {
    const isAdmin = req.user.role === 'admin';
    const data = await this.projectSitesService.findByProject(
      projectId,
      isAdmin ? undefined : req.user.id,
    );
    return { data };
  }

  /**
   * GET /sites/:id — Get a single site by ID.
   */
  @Get('sites/:id')
  @Roles('contractor', 'admin', 'site_engineer')
  async findOne(@Req() req: any, @Param('id') id: string) {
    const isAdmin = req.user.role === 'admin';
    const data = await this.projectSitesService.findOne(
      id,
      isAdmin ? undefined : req.user.id,
    );
    return { data };
  }

  /**
   * PATCH /sites/:id — Update a site.
   */
  @Patch('sites/:id')
  @Roles('contractor', 'admin')
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateProjectSiteDto,
  ) {
    const site = await this.projectSitesService.update(id, req.user.id, dto);
    return { message: 'Site updated successfully', data: site };
  }

  /**
   * POST /sites/:siteId/assign-engineer — Assign a site engineer.
   */
  @Post('sites/:siteId/assign-engineer')
  @Roles('contractor', 'admin')
  async assignEngineer(
    @Req() req: any,
    @Param('siteId') siteId: string,
    @Body() dto: AssignEngineerDto,
  ) {
    const assignment = await this.projectSitesService.assignEngineer(
      siteId,
      req.user.id,
      dto,
    );
    return { message: 'Engineer assigned successfully', data: assignment };
  }

  /**
   * DELETE /sites/:siteId/assignments/:assignmentId — Remove an engineer.
   */
  @Delete('sites/:siteId/assignments/:assignmentId')
  @Roles('contractor', 'admin')
  async removeEngineer(
    @Req() req: any,
    @Param('siteId') siteId: string,
    @Param('assignmentId') assignmentId: string,
  ) {
    await this.projectSitesService.removeEngineer(
      siteId,
      assignmentId,
      req.user.id,
    );
    return { message: 'Engineer removed from site' };
  }

  /**
   * GET /sites/my-sites — Site Engineer gets their assigned sites.
   */
  @Get('sites/my-sites')
  @Roles('site_engineer')
  async findMySites(@Req() req: any) {
    const data = await this.projectSitesService.findMySites(req.user.id);
    return { data };
  }
}
