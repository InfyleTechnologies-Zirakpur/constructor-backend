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
import { JobsService } from './jobs.service.js';
import { CreateJobDto } from './dto/create-jobs.dto.js';
import { UpdateJobDto, ModerateJobDto } from './dto/update-jobs.dto.js';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';

@Controller('jobs')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Post()
  @Roles('company')
  async create(@Req() req: any, @Body() dto: CreateJobDto) {
    const job = await this.jobsService.create(req.user.id, dto);
    return { message: 'Job created successfully', data: job };
  }

  @Get()
  @Roles('admin', 'company', 'job_seeker')
  async list(
    @Req() req: any,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ) {
    return this.jobsService.list(
      Number(page),
      Number(limit),
      req.user.role,
      req.user.id,
    );
  }

  @Get(':id')
  @Roles('admin', 'company', 'job_seeker')
  async getById(@Req() req: any, @Param('id') id: string) {
    const job = await this.jobsService.getById(id, req.user.role, req.user.id);
    return { data: job };
  }

  @Patch(':id')
  @Roles('company')
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateJobDto,
  ) {
    const job = await this.jobsService.update(id, req.user.id, dto);
    return { message: 'Job updated successfully', data: job };
  }

  @Post(':id/close')
  @Roles('company')
  async close(@Req() req: any, @Param('id') id: string) {
    const job = await this.jobsService.close(id, req.user.id);
    return { message: 'Job closed successfully', data: job };
  }

  @Patch(':id/moderate')
  @Roles('admin')
  async moderate(@Param('id') id: string, @Body() dto: ModerateJobDto) {
    const job = await this.jobsService.moderate(id, dto);
    return { message: 'Job moderated successfully', data: job };
  }
}
