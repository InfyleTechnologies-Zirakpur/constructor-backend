import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Payment } from './entities/payment.entity.js';
import { User } from '../users/entities/user.entity.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';
import { UpdatePaymentStatusDto } from './dto/update-payment-status.dto.js';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async create(
    userId: string,
    role: string,
    dto: CreatePaymentDto,
  ): Promise<Payment> {
    const status = dto.status ?? 'pending';
    const txnId = dto.transactionId ?? `TXN-${randomUUID().slice(0, 8).toUpperCase()}`;

    const payment = this.paymentRepo.create({
      jobId: dto.jobId ?? null,
      workerId: dto.workerId ?? null,
      contractorId: dto.contractorId ?? (role === 'contractor' ? userId : null),
      amount: Number(dto.amount),
      currency: dto.currency ?? 'INR',
      status,
      transactionId: txnId,
      paymentMethod: dto.paymentMethod ?? 'bank_transfer',
      description: dto.description ?? null,
      paidAt: status === 'completed' ? new Date() : null,
    });

    return this.paymentRepo.save(payment);
  }

  async findAll(
    userId: string,
    role: string,
    query: {
      status?: string;
      workerId?: string;
      jobId?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.max(1, Math.min(100, Number(query.limit || 10)));
    const skip = (page - 1) * limit;

    const qb = this.paymentRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.job', 'job')
      .leftJoinAndSelect('p.worker', 'worker');

    if (role === 'job_seeker') {
      qb.where('p.workerId = :userId', { userId });
    } else if (role === 'contractor') {
      qb.where('p.contractorId = :userId', { userId });
    }

    if (query.status) {
      qb.andWhere('p.status = :status', { status: query.status });
    }

    if (query.workerId && role !== 'job_seeker') {
      qb.andWhere('p.workerId = :workerId', { workerId: query.workerId });
    }

    if (query.jobId) {
      qb.andWhere('p.jobId = :jobId', { jobId: query.jobId });
    }

    qb.orderBy('p.createdAt', 'DESC').skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();

    const totalAmount = items.reduce((sum, item) => sum + Number(item.amount), 0);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      summary: {
        totalAmount: Number(totalAmount.toFixed(2)),
      },
    };
  }

  async findOne(id: string, userId: string, role: string): Promise<Payment> {
    const payment = await this.paymentRepo.findOne({
      where: { id },
      relations: { job: true, worker: true },
    });

    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }

    if (role === 'job_seeker' && payment.workerId !== userId) {
      throw new ForbiddenException('You do not have access to this payment');
    }

    if (role === 'contractor' && payment.contractorId !== userId) {
      throw new ForbiddenException('You do not have access to this payment');
    }

    return payment;
  }

  async updateStatus(
    id: string,
    userId: string,
    role: string,
    dto: UpdatePaymentStatusDto,
  ): Promise<Payment> {
    const payment = await this.findOne(id, userId, role);

    if (role !== 'admin' && role !== 'contractor') {
      throw new ForbiddenException('Only admin or contractor can update payment status');
    }

    payment.status = dto.status;
    if (dto.transactionId) payment.transactionId = dto.transactionId;
    if (dto.status === 'completed' && !payment.paidAt) {
      payment.paidAt = new Date();
    }
    if (dto.remarks) {
      payment.description = payment.description
        ? `${payment.description} | ${dto.remarks}`
        : dto.remarks;
    }

    return this.paymentRepo.save(payment);
  }

  async refund(
    id: string,
    userId: string,
    role: string,
    reason?: string,
  ): Promise<Payment> {
    const payment = await this.findOne(id, userId, role);

    if (role !== 'admin') {
      throw new ForbiddenException('Only admin can refund payments');
    }

    if (payment.status !== 'completed') {
      throw new BadRequestException('Only completed payments can be refunded');
    }

    payment.status = 'refunded';
    if (reason) {
      payment.description = payment.description
        ? `${payment.description} | Refund Reason: ${reason}`
        : `Refund Reason: ${reason}`;
    }

    return this.paymentRepo.save(payment);
  }

  async getEarningsReport(workerId: string) {
    const payments = await this.paymentRepo.find({
      where: { workerId },
      order: { createdAt: 'DESC' },
    });

    const completed = payments.filter((p) => p.status === 'completed');
    const pending = payments.filter((p) => p.status === 'pending');

    const totalEarned = completed.reduce((sum, p) => sum + Number(p.amount), 0);
    const pendingAmount = pending.reduce((sum, p) => sum + Number(p.amount), 0);

    return {
      totalEarned: Number(totalEarned.toFixed(2)),
      pendingAmount: Number(pendingAmount.toFixed(2)),
      totalDisbursements: completed.length,
      pendingDisbursements: pending.length,
      history: payments.slice(0, 20),
    };
  }
}
