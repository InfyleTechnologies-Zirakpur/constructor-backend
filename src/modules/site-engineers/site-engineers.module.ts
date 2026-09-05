import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SiteEngineersController } from './site-engineers.controller.js';
import { SiteEngineersService } from './site-engineers.service.js';
import { User } from '../users/entities/user.entity.js';
import { SiteEngineerAssignment } from './entities/site-engineer-assignment.entity.js';
import { Contractor } from '../contractors/entities/contractor.entity.js';
import { ProjectSite } from '../project-sites/entities/project-site.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      SiteEngineerAssignment,
      Contractor,
      ProjectSite,
    ]),
  ],
  controllers: [SiteEngineersController],
  providers: [SiteEngineersService],
})
export class SiteEngineersModule {}
