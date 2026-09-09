import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Expense } from './entities/expense.entity.js';
import { SiteEngineerAssignment } from '../site-engineers/entities/site-engineer-assignment.entity.js';
import { CreateExpenseDto } from './dto/create-expenses.dto.js';
import { UpdateExpenseDto } from './dto/update-expenses.dto.js';

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepo: Repository<Expense>,

    @InjectRepository(SiteEngineerAssignment)
    private readonly assignmentRepo: Repository<SiteEngineerAssignment>,
  ) {}

  /**
   * Create an expense for a site.
   */
  async createExpense(
    siteId: string,
    userId: string,
    role: string,
    dto: CreateExpenseDto,
  ): Promise<Expense> {
    // Verify site access for site engineers
    if (role === 'site_engineer') {
      await this.verifySiteAccess(siteId, userId);
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
   */
  async listExpenses(siteId: string, date?: string) {
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
   */
  async getExpenseById(id: string): Promise<Expense> {
    const expense = await this.expenseRepo.findOne({ where: { id } });
    if (!expense) throw new NotFoundException('Expense not found');
    return expense;
  }

  /**
   * Update an expense (e.g. adding attachmentUrl after S3 upload).
   */
  async updateExpense(
    id: string,
    userId: string,
    role: string,
    dto: UpdateExpenseDto,
  ): Promise<Expense> {
    const expense = await this.getExpenseById(id);

    if (role === 'site_engineer') {
      await this.verifySiteAccess(expense.siteId, userId);
    }

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
}
