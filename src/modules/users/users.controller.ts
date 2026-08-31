import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { UsersService } from './users.service.js';
import { CreateUserDto } from './dto/create-users.dto.js';
import { UpdateUserDto, AdminUpdateUserDto } from './dto/update-users.dto.js';
import { User } from './entities/user.entity.js';

@Controller('users')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ─── Admin: List all users with optional role filter & pagination ───
  @Get()
  @Roles('admin')
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('role') role?: string,
  ) {
    return this.usersService.findAll(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      role,
    );
  }

  // ─── User: Get own profile ─────────────────────────────────────────
  @Get('profile')
  async getProfile(@CurrentUser() user: User) {
    return this.usersService.findOne(user.id);
  }

  // ─── User: Update own profile ──────────────────────────────────────
  @Patch('profile')
  async updateProfile(@CurrentUser() user: User, @Body() dto: UpdateUserDto) {
    return this.usersService.updateProfile(user.id, dto);
  }

  // ─── Admin: Get any user by ID ─────────────────────────────────────
  @Get(':id')
  @Roles('admin')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOne(id);
  }

  // ─── Admin: Create a new user ──────────────────────────────────────
  @Post()
  @Roles('admin')
  async create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  // ─── Admin: Update any user ────────────────────────────────────────
  @Patch(':id')
  @Roles('admin')
  async adminUpdate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminUpdateUserDto,
  ) {
    return this.usersService.adminUpdate(id, dto);
  }

  // ─── Admin: Deactivate a user ──────────────────────────────────────
  @Delete(':id')
  @Roles('admin')
  async deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ) {
    return this.usersService.deactivate(id, user);
  }
}
