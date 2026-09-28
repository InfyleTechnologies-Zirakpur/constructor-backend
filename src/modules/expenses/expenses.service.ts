import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Expense } from './entities/expense.entity.js';
import { SiteEngineerAssignment } from '../site-engineers/entities/site-engineer-assignment.entity.js';
import { Contractor } from '../contractors/entities/contractor.entity.js';
import { Project } from '../projects/entities/project.entity.js';
import { CreateExpenseDto } from './dto/create-expenses.dto.js';
import { UpdateExpenseDto } from './dto/update-expenses.dto.js';

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepo: Repository<Expense>,

    @InjectRepository(SiteEngineerAssignment)
    private readonly assignmentRepo: Repository<SiteEngineerAssignment>,

    @InjectRepository(Contractor)
    private readonly contractorRepo: Repository<Contractor>,

    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
  ) {}

  /**
   * Create an expense for a site.
   * Site engineers must be assigned to the site.
   * Contractors must own the site's project.
   */
  async createExpense(
    siteId: string,
    userId: string,
    role: string,
    dto: CreateExpenseDto,
  ): Promise<Expense> {
    if (role === 'site_engineer') {
      await this.verifySiteAccess(siteId, userId);
    } else if (role === 'contractor') {
      await this.verifyContractorSiteAccess(siteId, userId);
    }

    const expense = this.expenseRepo.create({
      siteId,
      date: dto.date,
      amount: dto.amount,
      category: dto.category,
      description: dto.description,
      remarks: dto.remarks,
      attachmentUrl: dto.attachmentUrl,
      createdById: userId,
    });

    return this.expenseRepo.save(expense);
  }

  /**
   * List expenses for a site.
   * Contractors must own the site's project; site engineers must be assigned.
   */
  async listExpenses(siteId: string, userId: string, role: string, date?: string) {
    if (role === 'site_engineer') {
      await this.verifySiteAccess(siteId, userId);
    } else if (role === 'contractor') {
      await this.verifyContractorSiteAccess(siteId, userId);
    }

    const query = this.expenseRepo
      .createQueryBuilder('e')
      .where('e.siteId = :siteId', { siteId });

    if (date) {
      query.andWhere('e.date = :date', { date });
    }

    query.orderBy('e.date', 'DESC').addOrderBy('e.createdAt', 'DESC');

    const expenses = await query.getMany();

    const totalAmount = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

    return {
      items: expenses,
      summary: {
        totalRecords: expenses.length,
        totalAmount: Number(totalAmount.toFixed(2)),
      },
    };
  }

  /**
   * Get an expense by ID.
   * Enforces access control: contractors see only their sites'; engineers see only assigned sites'.
   */
  async getExpenseById(id: string, userId: string, role: string): Promise<Expense> {
    const expense = await this.expenseRepo.findOne({ where: { id } });
    if (!expense) throw new NotFoundException('Expense not found');

    if (role === 'site_engineer') {
      await this.verifySiteAccess(expense.siteId, userId);
    } else if (role === 'contractor') {
      await this.verifyContractorSiteAccess(expense.siteId, userId);
    }

    return expense;
  }

  /**
   * Update an expense (e.g. adding attachmentUrl after upload).
   */
  async updateExpense(
    id: string,
    userId: string,
    role: string,
    dto: UpdateExpenseDto,
  ): Promise<Expense> {
    const expense = await this.getExpenseById(id, userId, role);
    Object.assign(expense, dto);
    return this.expenseRepo.save(expense);
  }

  /**
   * Get total expense for a site on a specific date (feeds into daily cost calculation).
   */
  async getSiteExpenseCost(siteId: string, date?: string): Promise<number> {
    const query = this.expenseRepo
      .createQueryBuilder('e')
      .select('SUM(e.amount)', 'total')
      .where('e.siteId = :siteId', { siteId });

    if (date) {
      query.andWhere('e.date = :date', { date });
    }

    const result = await query.getRawOne();
    return Number(result?.total ?? 0);
  }

  // ─── HELPERS ──────────────────────────────────────

  private async verifySiteAccess(
    siteId: string,
    userId: string,
  ): Promise<void> {
    const assignment = await this.assignmentRepo.findOne({
      where: { siteId, userId, isActive: true },
    });
    if (!assignment) {
      throw new ForbiddenException('You are not assigned to this site');
    }
  }

  private async verifyContractorSiteAccess(
    siteId: string,
    userId: string,
  ): Promise<void> {
    const contractor = await this.contractorRepo.findOne({ where: { userId } });
    if (!contractor) throw new ForbiddenException('Contractor profile not found');

    const project = await this.projectRepo
      .createQueryBuilder('p')
      .innerJoin('project_sites', 'ps', 'ps."projectId" = p.id')
      .where('ps.id = :siteId', { siteId })
      .andWhere('p."contractorId" = :contractorId', { contractorId: contractor.id })
      .getOne();

    if (!project) {
      throw new ForbiddenException('You do not have access to this site');
    }
  }
}
