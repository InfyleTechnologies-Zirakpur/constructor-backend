import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity.js';
import type { CreateUserDto } from './dto/create-users.dto.js';
import type {
  UpdateUserDto,
  AdminUpdateUserDto,
} from './dto/update-users.dto.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
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

  // ─── Admin: List All Users (with pagination) ────────────────────────

  async findAll(page = 1, limit = 20, role?: string) {
    const query = this.userRepository.createQueryBuilder('user');

    if (role) {
      query.where('user.role = :role', { role });
    }

    query
      .select([
        'user.id',
        'user.fullName',
        'user.email',
        'user.phone',
        'user.role',
        'user.isActive',
        'user.avatarUrl',
        'user.createdAt',
        'user.updatedAt',
      ])
      .orderBy('user.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [users, total] = await query.getManyAndCount();

    return {
      users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─── Get Single User By ID ──────────────────────────────────────────

  async findOne(id: string) {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }
    return this.sanitize(user);
  }

  // ─── Admin: Create User ─────────────────────────────────────────────

  async create(dto: CreateUserDto) {
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
      role: dto.role,
    });

    const savedUser = await this.userRepository.save(user);
    return this.sanitize(savedUser);
  }

  // ─── User: Update Own Profile ───────────────────────────────────────

  async updateProfile(userId: string, dto: UpdateUserDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with ID "${userId}" not found`);
    }

    if (dto.fullName !== undefined) user.fullName = dto.fullName;
    if (dto.phone !== undefined) user.phone = dto.phone;
    if (dto.avatarUrl !== undefined) user.avatarUrl = dto.avatarUrl;

    const savedUser = await this.userRepository.save(user);
    return this.sanitize(savedUser);
  }

  // ─── Admin: Update Any User (including role, isActive) ──────────────

  async adminUpdate(userId: string, dto: AdminUpdateUserDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with ID "${userId}" not found`);
    }

    if (dto.fullName !== undefined) user.fullName = dto.fullName;
    if (dto.phone !== undefined) user.phone = dto.phone;
    if (dto.avatarUrl !== undefined) user.avatarUrl = dto.avatarUrl;
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.isActive !== undefined) user.isActive = dto.isActive;

    const savedUser = await this.userRepository.save(user);
    return this.sanitize(savedUser);
  }

  // ─── Admin: Deactivate User ─────────────────────────────────────────

  async deactivate(userId: string, requestingUser: User) {
    if (userId === requestingUser.id) {
      throw new ForbiddenException('You cannot deactivate your own account');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with ID "${userId}" not found`);
    }

    user.isActive = false;
    user.refreshTokenHash = null; // Invalidate their sessions
    const savedUser = await this.userRepository.save(user);
    return this.sanitize(savedUser);
  }
}
