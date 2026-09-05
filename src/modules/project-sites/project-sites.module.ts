import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectSitesController } from './project-sites.controller.js';
import { ProjectSitesService } from './project-sites.service.js';
import { ProjectSite } from './entities/project-site.entity.js';
import { Project } from '../projects/entities/project.entity.js';
import { Contractor } from '../contractors/entities/contractor.entity.js';
import { User } from '../users/entities/user.entity.js';
import { SiteEngineerAssignment } from '../site-engineers/entities/site-engineer-assignment.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProjectSite,
      Project,
      Contractor,
      User,
      SiteEngineerAssignment,
    ]),
  ],
  controllers: [ProjectSitesController],
  providers: [ProjectSitesService],
  exports: [ProjectSitesService],
})
export class ProjectSitesModule {}
