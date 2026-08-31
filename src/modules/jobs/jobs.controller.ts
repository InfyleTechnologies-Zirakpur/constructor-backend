import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { JobsService } from './jobs.service.js';

@Controller('jobs')
export class JobsController {
  constructor(private readonly jobsService: JobsService) {}

  @Get()
  async list(@Query('page') page = '1', @Query('limit') limit = '10') {
    return this.jobsService.list(Number(page), Number(limit));
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.jobsService.getById(id);
  }

  @Post()
  async create(@Body() dto: any) {
    return this.jobsService.create(dto);
  }
}
