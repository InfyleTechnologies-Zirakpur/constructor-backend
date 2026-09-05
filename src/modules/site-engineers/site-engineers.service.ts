import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../users/entities/user.entity.js';
import { SiteEngineerAssignment } from './entities/site-engineer-assignment.entity.js';
import { Contractor } from '../contractors/entities/contractor.entity.js';
import { ProjectSite } from '../project-sites/entities/project-site.entity.js';
import { CreateSiteEngineerDto } from './dto/create-site-engineers.dto.js';

@Injectable()
export class SiteEngineersService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(SiteEngineerAssignment)
    private readonly assignmentRepository: Repository<SiteEngineerAssignment>,
    @InjectRepository(Contractor)
    private readonly contractorRepository: Repository<Contractor>,
    @InjectRepository(ProjectSite)
    private readonly siteRepository: Repository<ProjectSite>,
  ) {}

  /**
   * Strips sensitive fields from a user object before returning it.
   */
  private sanitize(user: User) {
    const {
      passwordHash: _,
      otpHash: __,
      otpExpiresAt: ___,
      refreshTokenHash: ____,
      ...safeUser
    } = user;
    return safeUser;
  }

  /**
   * Contractor or Admin creates a new Site Engineer account.
   */
  async createSiteEngineer(dto: CreateSiteEngineerDto) {
    const existing = await this.userRepository.findOne({
      where: { email: dto.email },
    });
    if (existing) {
      throw new BadRequestException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = this.userRepository.create({
      fullName: dto.fullName,
      email: dto.email,
      phone: dto.phone,
      passwordHash,
      role: 'site_engineer',
    });

    const savedUser = await this.userRepository.save(user);
    return this.sanitize(savedUser);
  }

  /**
   * Returns site engineers. Admin sees all, contractor sees only engineers assigned to their sites.
   */
  async listEngineers(
    userId: string,
    role: string,
  ): Promise<{ data: Partial<User>[] }> {
    if (role === 'admin') {
      const engineers = await this.userRepository.find({
        where: { role: 'site_engineer' },
        order: { createdAt: 'DESC' },
      });
      return { data: engineers.map(this.sanitize) };
    }

    // For Contractor, find engineers assigned to any of their sites
    const contractor = await this.contractorRepository.findOne({
      where: { userId },
    });

    if (!contractor) {
      throw new NotFoundException('Contractor profile not found');
    }

    // Find all assignments for this contractor's sites
    const assignments = await this.assignmentRepository
      .createQueryBuilder('assignment')
      .innerJoinAndSelect('assignment.user', 'user')
      .innerJoin('assignment.site', 'site')
      .innerJoin('site.project', 'project')
      .where('project.contractorId = :contractorId', {
        contractorId: contractor.id,
      })
      .andWhere('assignment.isActive = :isActive', { isActive: true })
      .getMany();

    // Deduplicate engineers using Map
    const engineerMap = new Map<string, Partial<User>>();
    for (const a of assignments) {
      if (!engineerMap.has(a.user.id)) {
        engineerMap.set(a.user.id, this.sanitize(a.user));
      }
    }

    return { data: Array.from(engineerMap.values()) };
  }

  /**
   * Get an engineer's profile and active assignments.
   * Access is constrained: Admin can view any, Contractor can view if the engineer is assigned to their sites, Engineer can view themselves.
   */
  async getProfile(
    engineerId: string,
    requestingUserId: string,
    requestingRole: string,
  ) {
    const engineer = await this.userRepository.findOne({
      where: { id: engineerId, role: 'site_engineer' },
    });

    if (!engineer) {
      throw new NotFoundException('Site engineer not found');
    }

    const assignments = await this.assignmentRepository.find({
      where: { userId: engineerId, isActive: true },
      relations: { site: { project: true } },
    });

    // Access control checks
    if (requestingRole === 'site_engineer') {
      if (requestingUserId !== engineerId) {
        throw new ForbiddenException('You can only view your own profile');
      }
    } else if (requestingRole === 'contractor') {
      const contractor = await this.contractorRepository.findOne({
        where: { userId: requestingUserId },
      });
      if (!contractor)
        throw new NotFoundException('Contractor profile not found');

      // Check if engineer is assigned to ANY site owned by this contractor
      const isAssignedToContractor = assignments.some(
        (a) => a.site.project.contractorId === contractor.id,
      );

      if (!isAssignedToContractor) {
        throw new ForbiddenException(
          'You can only view profiles of engineers assigned to your sites',
        );
      }
    }

    return {
      engineer: this.sanitize(engineer),
      activeAssignments: assignments.map((a) => ({
        assignmentId: a.id,
        assignedAt: a.assignedAt,
        site: {
          id: a.site.id,
          name: a.site.name,
          location: a.site.location,
          project: {
            id: a.site.project.id,
            name: a.site.project.name,
          },
        },
      })),
    };
  }
}
