import { Module } from '@nestjs/common';
import { ProjectSitesController } from './project-sites.controller.js';
import { ProjectSitesService } from './project-sites.service.js';

@Module({
  controllers: [ProjectSitesController],
  providers: [ProjectSitesService],
})
export class ProjectSitesModule {}
