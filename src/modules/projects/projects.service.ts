import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from './entities/project.entity.js';
import { CreateProjectDto } from './dto/create-projects.dto.js';
import { UpdateProjectDto } from './dto/update-projects.dto.js';
import { Contractor } from '../contractors/entities/contractor.entity.js';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(Contractor)
    private readonly contractorRepository: Repository<Contractor>,
  ) {}

  /**
   * A contractor creates a project. We first resolve their contractor profile
   * from their userId, then link the project to that contractor.
   */
  async create(userId: string, dto: CreateProjectDto): Promise<Project> {
    const contractor = await this.contractorRepository.findOne({
      where: { userId },
    });

    if (!contractor) {
      throw new NotFoundException(
        'Contractor profile not found. Please create a contractor profile first.',
      );
    }

    const project = this.projectRepository.create({
      ...dto,
      contractorId: contractor.id,
      status: 'draft',
    });

    return this.projectRepository.save(project);
  }

  /**
   * Contractor sees only their own projects.
   */
  async findMyProjects(
    userId: string,
    page: number = 1,
    limit: number = 10,
    status?: string,
  ): Promise<{ data: Project[]; total: number }> {
    const contractor = await this.contractorRepository.findOne({
      where: { userId },
    });

    if (!contractor) {
      return { data: [], total: 0 };
    }

    const query = this.projectRepository
      .createQueryBuilder('project')
      .where('project.contractorId = :contractorId', {
        contractorId: contractor.id,
      })
      .leftJoinAndSelect('project.sites', 'sites');

    if (status) {
      query.andWhere('project.status = :status', { status });
    }

    query.skip((page - 1) * limit).take(limit);
    query.orderBy('project.createdAt', 'DESC');

    const [data, total] = await query.getManyAndCount();
    return { data, total };
  }

  /**
   * Get a single project by ID. Enforces contractor isolation —
   * a contractor can only view their own projects.
   */
  async findOne(id: string, userId?: string): Promise<Project> {
    const project = await this.projectRepository.findOne({
      where: { id },
      relations: { sites: true, contractor: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // If userId is provided (non-admin), verify ownership
    if (userId) {
      const contractor = await this.contractorRepository.findOne({
        where: { userId },
      });
      if (!contractor || project.contractorId !== contractor.id) {
        throw new ForbiddenException('You do not have access to this project');
      }
    }

    return project;
  }

  /**
   * Contractor updates their own project.
   */
  async update(
    id: string,
    userId: string,
    dto: UpdateProjectDto,
  ): Promise<Project> {
    const project = await this.findOne(id, userId);
    Object.assign(project, dto);
    return this.projectRepository.save(project);
  }

  /**
   * Stats for dashboard top cards — Onsite-style APPROV/MATERIAL/TO DO
   * Contractor scoped, admin global.
   */
  async getStats(userId?: string): Promise<{ total: number; draft: number; active: number; completed: number; sites: number; budget: number }> {
    let contractorId: string | undefined;
    if (userId) {
      const contractor = await this.contractorRepository.findOne({ where: { userId } });
      if (!contractor) return { total: 0, draft: 0, active: 0, completed: 0, sites: 0, budget: 0 };
      contractorId = contractor.id;
    }
    const qb = this.projectRepository.createQueryBuilder('project').leftJoin('project.sites', 'site');
    if (contractorId) qb.where('project.contractorId = :contractorId', { contractorId });
    const total = await qb.getCount();
    const draft = await qb.clone().andWhere('project.status = :s', { s: 'draft' }).getCount();
    const active = await qb.clone().andWhere('project.status IN (:...s)', { s: ['active','in_progress'] }).getCount();
    const completed = await qb.clone().andWhere('project.status = :s', { s: 'completed' }).getCount();
    const sitesQb = this.projectRepository.manager.createQueryBuilder().from('project_sites', 'ps');
    if (contractorId) sitesQb.innerJoin('projects', 'p', 'p.id = ps."projectId"').where('p."contractorId" = :contractorId', { contractorId });
    const sites = await sitesQb.getCount();
    // budget sum
    const sumQb = this.projectRepository.createQueryBuilder('project').select('COALESCE(SUM(project.budget),0)', 'sum');
    if (contractorId) sumQb.where('project.contractorId = :contractorId', { contractorId });
    const raw = await sumQb.getRawOne();
    return { total, draft, active, completed, sites, budget: Number(raw?.sum ?? 0) };
  }

  /**
   * Admin lists all projects with pagination and optional status filter.
   */
  async findAll(
    page: number = 1,
    limit: number = 10,
    status?: string,
  ): Promise<{ data: Project[]; total: number }> {
    const query = this.projectRepository
      .createQueryBuilder('project')
      .leftJoinAndSelect('project.contractor', 'contractor')
      .leftJoinAndSelect('project.sites', 'sites');

    if (status) {
      query.andWhere('project.status = :status', { status });
    }

    query.skip((page - 1) * limit).take(limit);
    query.orderBy('project.createdAt', 'DESC');

    const [data, total] = await query.getManyAndCount();
    return { data, total };
  }
}
