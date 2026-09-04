import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ProjectsService } from './projects.service.js';
import { CreateProjectDto } from './dto/create-projects.dto.js';
import { UpdateProjectDto } from './dto/update-projects.dto.js';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';

@Controller('projects')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  /**
   * POST /projects — Contractor creates a new project.
   * The service resolves the contractor profile from the JWT user.
   */
  @Post()
  @Roles('contractor', 'admin')
  async create(@Req() req: any, @Body() dto: CreateProjectDto) {
    const project = await this.projectsService.create(req.user.id, dto);
    return { message: 'Project created successfully', data: project };
  }

  /**
   * GET /projects/my-projects — Contractor views their own projects.
   */
  @Get('my-projects')
  @Roles('contractor')
  async findMyProjects(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    const pageNumber = parseInt(page ?? '1', 10);
    const limitNumber = parseInt(limit ?? '10', 10);
    return this.projectsService.findMyProjects(
      req.user.id,
      pageNumber,
      limitNumber,
      status,
    );
  }

  /**
   * GET /projects/:id — Contractor views one of their projects (with sites).
   * Admin can view any project.
   */
  @Get(':id')
  @Roles('contractor', 'admin')
  async findOne(@Req() req: any, @Param('id') id: string) {
    const isAdmin = req.user.role === 'admin';
    const data = await this.projectsService.findOne(
      id,
      isAdmin ? undefined : req.user.id,
    );
    return { data };
  }

  /**
   * PATCH /projects/:id — Contractor updates their project.
   */
  @Patch(':id')
  @Roles('contractor', 'admin')
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    const project = await this.projectsService.update(id, req.user.id, dto);
    return { message: 'Project updated successfully', data: project };
  }

  /**
   * GET /projects — Admin lists all projects (paginated, filterable by status).
   */
  @Get()
  @Roles('admin')
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    const pageNumber = parseInt(page ?? '1', 10);
    const limitNumber = parseInt(limit ?? '10', 10);
    return this.projectsService.findAll(pageNumber, limitNumber, status);
  }
}
