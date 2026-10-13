import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { WorkersService } from './workers.service.js';
import { CreateWorkerDto } from './dto/create-worker.dto.js';
import { UpdateWorkerDto } from './dto/update-worker.dto.js';

@Controller('workers')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class WorkersController {
  constructor(private readonly workersService: WorkersService) {}

  /**
   * GET /workers — Search and filter workers.
   */
  @Get()
  @Roles('admin', 'contractor', 'company')
  async findAll(
    @Query('skill') skill?: string,
    @Query('city') city?: string,
    @Query('availability') availability?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.workersService.findAll({
      skill,
      city,
      availability,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 10,
    });
    return { success: true, data };
  }

  /**
   * POST /workers — Create a new worker profile.
   */
  @Post()
  @Roles('admin', 'contractor')
  async create(@Body() dto: CreateWorkerDto) {
    const worker = await this.workersService.create(dto);
    return {
      success: true,
      message: 'Worker profile created successfully',
      data: worker,
    };
  }

  /**
   * GET /workers/:id — Get worker details by ID.
   */
  @Get(':id')
  @Roles('admin', 'contractor', 'company', 'job_seeker', 'site_engineer')
  async findOne(@Param('id') id: string) {
    const worker = await this.workersService.findOne(id);
    return { success: true, data: worker };
  }

  /**
   * PUT /workers/:id — Update worker profile.
   */
  @Put(':id')
  @Roles('admin', 'contractor')
  async update(@Param('id') id: string, @Body() dto: UpdateWorkerDto) {
    const worker = await this.workersService.update(id, dto);
    return {
      success: true,
      message: 'Worker profile updated successfully',
      data: worker,
    };
  }

  /**
   * PATCH /workers/:id — Partial update worker profile.
   */
  @Patch(':id')
  @Roles('admin', 'contractor')
  async partialUpdate(@Param('id') id: string, @Body() dto: UpdateWorkerDto) {
    const worker = await this.workersService.update(id, dto);
    return {
      success: true,
      message: 'Worker profile updated successfully',
      data: worker,
    };
  }

  /**
   * DELETE /workers/:id — Delete worker profile.
   */
  @Delete(':id')
  @Roles('admin', 'contractor')
  async remove(@Param('id') id: string) {
    await this.workersService.remove(id);
    return {
      success: true,
      message: 'Worker profile deleted successfully',
    };
  }
}
