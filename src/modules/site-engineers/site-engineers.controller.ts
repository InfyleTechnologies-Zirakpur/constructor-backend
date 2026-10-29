import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Put,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SiteEngineersService } from './site-engineers.service.js';
import { CreateSiteEngineerDto } from './dto/create-site-engineers.dto.js';
import { UpdateEngineerPasswordDto } from './dto/update-engineer-password.dto.js';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { AuthorizationService } from '../authorization/authorization.service.js';

@Controller('site-engineers')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class SiteEngineersController {
  constructor(
    private readonly siteEngineersService: SiteEngineersService,
    private readonly authz: AuthorizationService,
  ) {}

  /**
   * POST /site-engineers — Contractor (or Admin) creates a new Site Engineer account.
   */
  @Post()
  @Roles('contractor', 'admin')
  async create(@Body() dto: CreateSiteEngineerDto) {
    const engineer = await this.siteEngineersService.createSiteEngineer(dto);
    return { message: 'Site Engineer created successfully', data: engineer };
  }

  /**
   * GET /site-engineers — List site engineers.
   * Admins see all. Contractors see only those assigned to their sites.
   */
  @Get()
  @Roles('contractor', 'admin')
  async listEngineers(@Req() req: any) {
    const { id, role } = req.user;
    return this.siteEngineersService.listEngineers(id, role);
  }

  /**
   * GET /site-engineers/my-profile — Site Engineer views their own profile + assignments
   */
  @Get('my-profile')
  @Roles('site_engineer')
  async getMyProfile(@Req() req: any) {
    return this.siteEngineersService.getProfile(
      req.user.id,
      req.user.id,
      req.user.role,
    );
  }

  /**
   * GET /site-engineers/stats — Site Engineer dashboard (assigned sites, today labour/material stats)
   */
  @Get('stats')
  @Roles('site_engineer', 'contractor', 'admin')
  async getStats(@Req() req: any) {
    return this.siteEngineersService.getStats(req.user.id, req.user.role);
  }

  /**
   * PUT /site-engineers/:id/password — Contractor (or Admin) sets a new
   * password for a site engineer. Engineers have no self-service reset.
   */
  @Put(':id/password')
  @HttpCode(HttpStatus.OK)
  @Roles('contractor', 'admin')
  async updatePassword(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateEngineerPasswordDto,
  ) {
    const { id: requestingUserId, role } = req.user;
    return this.siteEngineersService.updatePassword(
      id,
      dto.password,
      requestingUserId,
      role,
    );
  }

  /**
   * GET /site-engineers/:id — Get a specific engineer's profile.
   * Admins see any. Contractors see only those assigned to their sites.
   */
  @Get(':id')
  @Roles('contractor', 'admin')
  async getProfile(@Req() req: any, @Param('id') id: string) {
    const { id: requestingUserId, role } = req.user;
    return this.siteEngineersService.getProfile(id, requestingUserId, role);
  }
}
