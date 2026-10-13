import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Worker } from './entities/worker.entity.js';
import { User } from '../users/entities/user.entity.js';
import { CreateWorkerDto } from './dto/create-worker.dto.js';
import { UpdateWorkerDto } from './dto/update-worker.dto.js';

@Injectable()
export class WorkersService {
  constructor(
    @InjectRepository(Worker)
    private readonly workerRepo: Repository<Worker>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async findAll(query: {
    skill?: string;
    city?: string;
    availability?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(query.page || 1));
    const limit = Math.max(1, Math.min(100, Number(query.limit || 10)));
    const skip = (page - 1) * limit;

    const qb = this.workerRepo.createQueryBuilder('worker');

    if (query.skill) {
      qb.andWhere('worker.skills LIKE :skill', { skill: `%${query.skill}%` });
    }

    if (query.city) {
      qb.andWhere('LOWER(worker.city) LIKE LOWER(:city)', {
        city: `%${query.city}%`,
      });
    }

    if (query.availability) {
      qb.andWhere('worker.availability = :availability', {
        availability: query.availability,
      });
    }

    qb.orderBy('worker.createdAt', 'DESC').skip(skip).take(limit);

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<Worker> {
    const worker = await this.workerRepo.findOne({
      where: { id },
      relations: { user: true },
    });
    if (!worker) {
      throw new NotFoundException(`Worker with ID ${id} not found`);
    }
    return worker;
  }

  async create(dto: CreateWorkerDto): Promise<Worker> {
    const worker = this.workerRepo.create({
      name: dto.name,
      phone: dto.phone,
      email: dto.email,
      city: dto.city,
      skills: dto.skills ?? [],
      experience: dto.experience ?? null,
      certifications: dto.certifications ?? [],
      documents: dto.documents ?? [],
      availability: dto.availability ?? 'available',
      rating: dto.rating !== undefined ? Number(dto.rating) : 4.5,
      userId: dto.userId ?? null,
    });

    return this.workerRepo.save(worker);
  }

  async update(id: string, dto: UpdateWorkerDto): Promise<Worker> {
    const worker = await this.findOne(id);

    if (dto.name !== undefined) worker.name = dto.name;
    if (dto.phone !== undefined) worker.phone = dto.phone;
    if (dto.email !== undefined) worker.email = dto.email;
    if (dto.city !== undefined) worker.city = dto.city;
    if (dto.skills !== undefined) worker.skills = dto.skills;
    if (dto.experience !== undefined) worker.experience = dto.experience;
    if (dto.certifications !== undefined)
      worker.certifications = dto.certifications;
    if (dto.documents !== undefined) worker.documents = dto.documents;
    if (dto.availability !== undefined) worker.availability = dto.availability;
    if (dto.rating !== undefined) worker.rating = Number(dto.rating);

    return this.workerRepo.save(worker);
  }

  async remove(id: string): Promise<void> {
    const worker = await this.findOne(id);
    await this.workerRepo.remove(worker);
  }
}
