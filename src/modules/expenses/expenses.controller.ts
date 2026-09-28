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
   * Site engineers must be assigned to the site; contractors must own it.
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
   * Access controlled: only users with access to this site.
   */
  @Get('sites/:siteId/expenses')
  @Roles('admin', 'contractor', 'site_engineer')
  async listExpenses(
    @Req() req: any,
    @Param('siteId') siteId: string,
    @Query('date') date?: string,
  ) {
    const result = await this.expensesService.listExpenses(
      siteId,
      req.user.id,
      req.user.role,
      date,
    );
    return { success: true, data: result };
  }

  /**
   * GET /expenses/:id — Get a single expense.
   * Access controlled: user must have access to the expense's site.
   */
  @Get('expenses/:id')
  @Roles('admin', 'contractor', 'site_engineer')
  async getExpense(@Req() req: any, @Param('id') id: string) {
    const expense = await this.expensesService.getExpenseById(
      id,
      req.user.id,
      req.user.role,
    );
    return { success: true, data: expense };
  }

  /**
   * PATCH /expenses/:id — Update an expense.
   * Access controlled: user must have access to the expense's site.
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
