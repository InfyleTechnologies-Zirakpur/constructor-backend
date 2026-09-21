import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectsController } from './projects.controller.js';
import { ProjectsService } from './projects.service.js';
import { Project } from './entities/project.entity.js';
import { Contractor } from '../contractors/entities/contractor.entity.js';
import { AuthorizationModule } from '../authorization/authorization.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Project, Contractor]), AuthorizationModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
