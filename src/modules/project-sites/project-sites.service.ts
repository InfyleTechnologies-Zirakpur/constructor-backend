import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectSite } from './entities/project-site.entity.js';
import { Project } from '../projects/entities/project.entity.js';
import { Contractor } from '../contractors/entities/contractor.entity.js';
import { User } from '../users/entities/user.entity.js';
import { SiteEngineerAssignment } from '../site-engineers/entities/site-engineer-assignment.entity.js';
import { CreateProjectSiteDto } from './dto/create-project-sites.dto.js';
import { UpdateProjectSiteDto } from './dto/update-project-sites.dto.js';
import { AssignEngineerDto } from './dto/assign-engineer.dto.js';

@Injectable()
export class ProjectSitesService {
  constructor(
    @InjectRepository(ProjectSite)
    private readonly siteRepository: Repository<ProjectSite>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(Contractor)
    private readonly contractorRepository: Repository<Contractor>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(SiteEngineerAssignment)
    private readonly assignmentRepository: Repository<SiteEngineerAssignment>,
  ) {}

  /**
   * Verifies that the requesting user (contractor) owns the project.
   * Returns the project if ownership is confirmed.
   */
  private async verifyProjectOwnership(
    projectId: string,
    userId: string,
  ): Promise<Project> {
    const project = await this.projectRepository.findOne({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const contractor = await this.contractorRepository.findOne({
      where: { userId },
    });

    if (!contractor || project.contractorId !== contractor.id) {
      throw new ForbiddenException('You do not have access to this project');
    }

    return project;
  }

  /**
   * Contractor creates a new site under their project.
   */
  async create(
    projectId: string,
    userId: string,
    dto: CreateProjectSiteDto,
  ): Promise<ProjectSite> {
    await this.verifyProjectOwnership(projectId, userId);

    const site = this.siteRepository.create({
      ...dto,
      projectId,
      status: 'active',
    });

    return this.siteRepository.save(site);
  }

  /**
   * Get all sites for a project. Contractor sees only their project's sites.
   */
  async findByProject(
    projectId: string,
    userId?: string,
  ): Promise<ProjectSite[]> {
    if (userId) {
      await this.verifyProjectOwnership(projectId, userId);
    }

    return this.siteRepository.find({
      where: { projectId },
      relations: { engineerAssignments: { user: true } },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get a single site by ID. Enforces contractor isolation.
   */
  async findOne(id: string, userId?: string): Promise<ProjectSite> {
    const site = await this.siteRepository.findOne({
      where: { id },
      relations: { project: true, engineerAssignments: { user: true } },
    });

    if (!site) {
      throw new NotFoundException('Project site not found');
    }

    if (userId) {
      const contractor = await this.contractorRepository.findOne({
        where: { userId },
      });
      if (!contractor || site.project.contractorId !== contractor.id) {
        throw new ForbiddenException('You do not have access to this site');
      }
    }

    return site;
  }

  /**
   * Contractor updates their site.
   */
  async update(
    id: string,
    userId: string,
    dto: UpdateProjectSiteDto,
  ): Promise<ProjectSite> {
    const site = await this.findOne(id, userId);
    Object.assign(site, dto);
    return this.siteRepository.save(site);
  }

  /**
   * Contractor assigns a site engineer to one of their sites.
   * The user being assigned must have the 'site_engineer' role.
   */
  async assignEngineer(
    siteId: string,
    userId: string,
    dto: AssignEngineerDto,
  ): Promise<SiteEngineerAssignment> {
    // Verify contractor owns the site
    const site = await this.findOne(siteId, userId);

    // Verify the target user exists and is a site_engineer
    const engineer = await this.userRepository.findOne({
      where: { id: dto.userId },
    });

    if (!engineer) {
      throw new NotFoundException('User not found');
    }

    if (engineer.role !== 'site_engineer') {
      throw new BadRequestException(
        'The specified user does not have the site_engineer role',
      );
    }

    // Check for duplicate active assignment
    const existing = await this.assignmentRepository.findOne({
      where: { siteId: site.id, userId: dto.userId, isActive: true },
    });

    if (existing) {
      throw new BadRequestException(
        'This engineer is already assigned to this site',
      );
    }

    const assignment = this.assignmentRepository.create({
      siteId: site.id,
      userId: dto.userId,
      isActive: true,
    });

    return this.assignmentRepository.save(assignment);
  }

  /**
   * Contractor removes (deactivates) an engineer from a site.
   */
  async removeEngineer(
    siteId: string,
    assignmentId: string,
    userId: string,
  ): Promise<void> {
    // Verify contractor owns the site
    await this.findOne(siteId, userId);

    const assignment = await this.assignmentRepository.findOne({
      where: { id: assignmentId, siteId },
    });

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    assignment.isActive = false;
    await this.assignmentRepository.save(assignment);
  }

  /**
   * Site Engineer gets only the sites they are assigned to.
   */
  async findMySites(userId: string): Promise<ProjectSite[]> {
    const assignments = await this.assignmentRepository.find({
      where: { userId, isActive: true },
      relations: { site: { project: true } },
    });

    return assignments.map((a) => a.site);
  }
}
