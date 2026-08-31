import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from './entities/project.entity.js';
import { ProjectSite } from '../project-sites/entities/project-site.entity.js';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(ProjectSite)
    private readonly projectSiteRepository: Repository<ProjectSite>,
  ) {}

  async createProject(dto: Partial<Project>) {
    const project = this.projectRepository.create({
      contractorId: dto.contractorId ?? 'contractor-1',
      name: dto.name ?? 'Untitled Project',
      location: dto.location ?? 'Location TBD',
      durationDays: dto.durationDays ?? 30,
      budget: dto.budget ?? 0,
      status: 'draft',
    });

    return this.projectRepository.save(project);
  }

  async createSite(projectId: string, dto: Partial<ProjectSite>) {
    const project = await this.projectRepository.findOne({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const site = this.projectSiteRepository.create({
      projectId,
      name: dto.name ?? 'Unnamed Site',
      location: dto.location ?? 'Unknown Location',
    });

    return this.projectSiteRepository.save(site);
  }

  async getProjectById(id: string) {
    const project = await this.projectRepository.findOne({ where: { id } });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }
}
