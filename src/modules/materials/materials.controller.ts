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
import { MaterialsService } from './materials.service.js';
import {
  CreateMaterialDto,
  CreateMaterialTransactionDto,
} from './dto/create-materials.dto.js';
import {
  UpdateMaterialDto,
  UpdateMaterialRequestDto,
} from './dto/update-materials.dto.js';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';

@Controller()
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class MaterialsController {
  constructor(private readonly materialsService: MaterialsService) {}

  // ═══════════════════════════════════════════════════
  //  MATERIAL MASTER ROUTES
  // ═══════════════════════════════════════════════════

  /**
   * POST /materials — Create a new material in the master catalog (Admin).
   */
  @Post('materials')
  @Roles('admin')
  async createMaterial(@Body() dto: CreateMaterialDto) {
    const material = await this.materialsService.createMaterial(dto);
    return {
      success: true,
      message: 'Material created successfully',
      data: material,
    };
  }

  /**
   * GET /materials — List all materials in the master catalog.
   */
  @Get('materials')
  @Roles('admin', 'contractor', 'site_engineer')
  async listMaterials(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('category') category?: string,
  ) {
    const result = await this.materialsService.listMaterials(
      Number(page),
      Number(limit),
      category,
    );
    return { success: true, data: result };
  }

  /**
   * GET /materials/:id — Get a single material.
   */
  @Get('materials/:id')
  @Roles('admin', 'contractor', 'site_engineer')
  async getMaterial(@Param('id') id: string) {
    const material = await this.materialsService.getMaterialById(id);
    return { success: true, data: material };
  }

  /**
   * PATCH /materials/:id — Update a material (Admin).
   */
  @Patch('materials/:id')
  @Roles('admin')
  async updateMaterial(
    @Param('id') id: string,
    @Body() dto: UpdateMaterialDto,
  ) {
    const material = await this.materialsService.updateMaterial(id, dto);
    return {
      success: true,
      message: 'Material updated successfully',
      data: material,
    };
  }

  // ═══════════════════════════════════════════════════
  //  SITE MATERIAL TRANSACTION ROUTES
  // ═══════════════════════════════════════════════════

  /**
   * POST /sites/:siteId/materials — Record a material transaction.
   */
  @Post('sites/:siteId/materials')
  @Roles('admin', 'contractor', 'site_engineer')
  async createTransaction(
    @Req() req: any,
    @Param('siteId') siteId: string,
    @Body() dto: CreateMaterialTransactionDto,
  ) {
    const transaction = await this.materialsService.createTransaction(
      siteId,
      req.user.id,
      req.user.role,
      dto,
    );
    return {
      success: true,
      message: 'Material transaction recorded',
      data: transaction,
    };
  }

  /**
   * GET /sites/:siteId/materials — List material transactions for a site.
   */
  @Get('sites/:siteId/materials')
  @Roles('admin', 'contractor', 'site_engineer')
  async listTransactions(
    @Param('siteId') siteId: string,
    @Query('type') type?: string,
    @Query('materialId') materialId?: string,
    @Query('date') date?: string,
  ) {
    const result = await this.materialsService.listTransactions(
      siteId,
      type,
      materialId,
      date,
    );
    return { success: true, data: result };
  }

  /**
   * GET /sites/:siteId/materials/stock — Get stock balance for a site.
   */
  @Get('sites/:siteId/materials/stock')
  @Roles('admin', 'contractor', 'site_engineer')
  async getStock(
    @Param('siteId') siteId: string,
    @Query('materialId') materialId?: string,
  ) {
    const result = await this.materialsService.getStock(siteId, materialId);
    return { success: true, data: result };
  }

  /**
   * PATCH /materials/transactions/:id/status — Update material request status.
   */
  @Patch('materials/transactions/:id/status')
  @Roles('admin', 'contractor')
  async updateRequestStatus(
    @Param('id') id: string,
    @Body() dto: UpdateMaterialRequestDto,
  ) {
    const transaction = await this.materialsService.updateRequestStatus(
      id,
      dto,
    );
    return {
      success: true,
      message: 'Request status updated',
      data: transaction,
    };
  }
}
