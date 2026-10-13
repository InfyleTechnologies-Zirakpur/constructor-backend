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
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { PaymentsService } from './payments.service.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto.js';

@Controller('payments')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * POST /payments — Process / record a payment.
   */
  @Post()
  @Roles('admin', 'contractor')
  async create(@Req() req: any, @Body() dto: CreatePaymentDto) {
    const payment = await this.paymentsService.create(
      req.user.id,
      req.user.role,
      dto,
    );
    return {
      success: true,
      message: 'Payment created successfully',
      data: payment,
    };
  }

  /**
   * GET /payments — List payments with filtering and role scoping.
   */
  @Get()
  @Roles('admin', 'contractor', 'job_seeker')
  async findAll(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('workerId') workerId?: string,
    @Query('jobId') jobId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const data = await this.paymentsService.findAll(
      req.user.id,
      req.user.role,
      {
        status,
        workerId,
        jobId,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 10,
      },
    );
    return { success: true, data };
  }

  /**
   * GET /payments/earnings — Worker earnings and salary disbursement summary.
   */
  @Get('earnings')
  @Roles('job_seeker')
  async getEarnings(@Req() req: any) {
    const data = await this.paymentsService.getEarningsReport(req.user.id);
    return { success: true, data };
  }

  /**
   * GET /payments/:id — Get payment details.
   */
  @Get(':id')
  @Roles('admin', 'contractor', 'job_seeker')
  async findOne(@Req() req: any, @Param('id') id: string) {
    const data = await this.paymentsService.findOne(
      id,
      req.user.id,
      req.user.role,
    );
    return { success: true, data };
  }

  /**
   * PATCH /payments/:id/status — Update payment status (e.g. mark completed).
   */
  @Patch(':id/status')
  @Roles('admin', 'contractor')
  async updateStatus(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdatePaymentStatusDto,
  ) {
    const payment = await this.paymentsService.updateStatus(
      id,
      req.user.id,
      req.user.role,
      dto,
    );
    return {
      success: true,
      message: `Payment status updated to ${dto.status}`,
      data: payment,
    };
  }

  /**
   * POST /payments/:id/refund — Process a payment refund (Admin).
   */
  @Post(':id/refund')
  @Roles('admin')
  async refund(
    @Req() req: any,
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    const payment = await this.paymentsService.refund(
      id,
      req.user.id,
      req.user.role,
      reason,
    );
    return {
      success: true,
      message: 'Payment refunded successfully',
      data: payment,
    };
  }
}
