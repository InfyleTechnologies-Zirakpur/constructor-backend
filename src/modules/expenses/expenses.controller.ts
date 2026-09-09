import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ExpensesService } from './expenses.service.js';
import { CreateExpenseDto } from './dto/create-expenses.dto.js';
import { UpdateExpenseDto } from './dto/update-expenses.dto.js';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';

@Controller()
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  /**
   * POST /sites/:siteId/expenses — Record a site expense.
   */
  @Post('sites/:siteId/expenses')
  @Roles('admin', 'contractor', 'site_engineer')
  async createExpense(
    @Req() req: any,
    @Param('siteId') siteId: string,
    @Body() dto: CreateExpenseDto,
  ) {
    const expense = await this.expensesService.createExpense(
      siteId,
      req.user.id,
      req.user.role,
      dto,
    );
    return {
      success: true,
      message: 'Expense recorded successfully',
      data: expense,
    };
  }

  /**
   * GET /sites/:siteId/expenses — List site expenses.
   */
  @Get('sites/:siteId/expenses')
  @Roles('admin', 'contractor', 'site_engineer')
  async listExpenses(
    @Param('siteId') siteId: string,
    @Query('date') date?: string,
  ) {
    const result = await this.expensesService.listExpenses(siteId, date);
    return { success: true, data: result };
  }

  /**
   * GET /expenses/:id — Get a single expense.
   */
  @Get('expenses/:id')
  @Roles('admin', 'contractor', 'site_engineer')
  async getExpense(@Param('id') id: string) {
    const expense = await this.expensesService.getExpenseById(id);
    return { success: true, data: expense };
  }

  /**
   * PATCH /expenses/:id — Update an expense (e.g. to attach S3 upload URL).
   */
  @Patch('expenses/:id')
  @Roles('admin', 'contractor', 'site_engineer')
  async updateExpense(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    const expense = await this.expensesService.updateExpense(
      id,
      req.user.id,
      req.user.role,
      dto,
    );
    return {
      success: true,
      message: 'Expense updated successfully',
      data: expense,
    };
  }
}
