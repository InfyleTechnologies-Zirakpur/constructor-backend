import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectSite } from './entities/project-site.entity.js';
import { Project } from '../projects/entities/project.entity.js';
import { Contractor } from '../contractors/entities/contractor.entity.js';
import { User } from '../users/entities/user.entity.js';
import { SiteEngineerAssignment } from '../site-engineers/entities/site-engineer-assignment.entity.js';
import { NotificationsService } from '../notifications/notifications.service.js';
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
    @Optional()
    private readonly notificationsService?: NotificationsService,
  ) {}

  /**
   * Verifies that the requesting user owns the project (or is admin).
   * Returns the project if ownership is confirmed.
   */
  private async verifyProjectOwnership(
    projectId: string,
    userId: string,
    role?: string,
  ): Promise<Project> {
    const project = await this.projectRepository.findOne({
      where: { id: projectId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (role === 'admin') {
      return project;
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
   * Contractor or Admin creates a new site under a project.
   */
  async create(
    projectId: string,
    userId: string,
    dto: CreateProjectSiteDto,
    role?: string,
  ): Promise<ProjectSite> {
    await this.verifyProjectOwnership(projectId, userId, role);

    const site = this.siteRepository.create({
      ...dto,
      projectId,
      status: 'active',
    });

    return this.siteRepository.save(site);
  }

  /**
   * Get all sites for a project. Contractor sees only their project's sites; Admin sees all.
   */
  async findByProject(
    projectId: string,
    userId?: string,
    role?: string,
  ): Promise<ProjectSite[]> {
    if (userId && role !== 'admin') {
      await this.verifyProjectOwnership(projectId, userId, role);
    }

    return this.siteRepository.find({
      where: { projectId },
      relations: { engineerAssignments: { user: true } },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get a single site by ID.
   * Enforces role isolation: Admin sees any, Contractor sees only their owned sites,
   * Site Engineer sees only assigned sites.
   */
  async findOne(
    id: string,
    userId?: string,
    role?: string,
  ): Promise<ProjectSite> {
    const site = await this.siteRepository.findOne({
      where: { id },
      relations: { project: true, engineerAssignments: { user: true } },
    });

    if (!site) {
      throw new NotFoundException('Project site not found');
    }

    if (!userId || role === 'admin') {
      return site;
    }

    if (role === 'site_engineer') {
      const assignment = await this.assignmentRepository.findOne({
        where: { siteId: id, userId, isActive: true },
      });
      if (!assignment) {
        throw new ForbiddenException('You are not assigned to this site');
      }
      return site;
    }

    // contractor check
    const contractor = await this.contractorRepository.findOne({
      where: { userId },
    });
    if (!contractor || site.project.contractorId !== contractor.id) {
      throw new ForbiddenException('You do not have access to this site');
    }

    return site;
  }

  /**
   * Contractor or Admin updates their site.
   */
  async update(
    id: string,
    userId: string,
    dto: UpdateProjectSiteDto,
    role?: string,
  ): Promise<ProjectSite> {
    const site = await this.findOne(id, userId, role);
    Object.assign(site, dto);
    return this.siteRepository.save(site);
  }

  /**
   * Contractor or Admin assigns a site engineer to a site.
   * The user being assigned must have the 'site_engineer' role.
   */
  async assignEngineer(
    siteId: string,
    userId: string,
    dto: AssignEngineerDto,
    role?: string,
  ): Promise<SiteEngineerAssignment> {
    // Verify contractor owns the site (or admin)
    const site = await this.findOne(siteId, userId, role);

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

    const saved = await this.assignmentRepository.save(assignment);

    try {
      await this.notificationsService?.notifySiteAssignment(
        site.id,
        site.name,
        dto.userId,
      );
    } catch {
      // Notification dispatch should not break assignment
    }

    return saved;
  }

  /**
   * Contractor or Admin removes (deactivates) an engineer from a site.
   */
  async removeEngineer(
    siteId: string,
    assignmentId: string,
    userId: string,
    role?: string,
  ): Promise<void> {
    // Verify contractor owns the site (or admin)
    await this.findOne(siteId, userId, role);

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
