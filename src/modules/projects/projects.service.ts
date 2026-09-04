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
      relations: ['sites', 'contractor'],
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
