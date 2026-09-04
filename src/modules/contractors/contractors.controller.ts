import {
  Controller,
  Post,
  Body,
  Get,
  Patch,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ContractorsService } from './contractors.service.js';
import { CreateContractorDto } from './dto/create-contractors.dto.js';
import {
  AdminVerifyContractorDto,
  UpdateContractorDto,
} from './dto/update-contractors.dto.js';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';

@Controller('contractors')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ContractorsController {
  constructor(private readonly contractorsService: ContractorsService) {}

  @Post()
  @Roles('contractor', 'admin')
  async create(@Req() req: any, @Body() dto: CreateContractorDto) {
    const contractor = await this.contractorsService.create(req.user.id, dto);
    return {
      message: 'Contractor profile created successfully',
      data: contractor,
    };
  }

  @Get('my-profile')
  @Roles('contractor')
  async findMyProfile(@Req() req: any) {
    const data = await this.contractorsService.findMyProfile(req.user.id);
    return { data };
  }

  @Patch(':id')
  @Roles('contractor', 'admin')
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateContractorDto,
  ) {
    const contractor = await this.contractorsService.update(
      id,
      req.user.id,
      dto,
    );
    return {
      message: 'Contractor profile updated successfully',
      data: contractor,
    };
  }

  @Get()
  @Roles('admin')
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    const pageNumber = parseInt(page ?? '1', 10);
    const limitNumber = parseInt(limit ?? '10', 10);
    return this.contractorsService.findAll(pageNumber, limitNumber, status);
  }

  @Get(':id')
  @Roles('admin')
  async findOne(@Param('id') id: string) {
    const data = await this.contractorsService.findOne(id);
    return { data };
  }

  @Patch(':id/verify')
  @Roles('admin')
  async verifyContractor(
    @Param('id') id: string,
    @Body() dto: AdminVerifyContractorDto,
  ) {
    const contractor = await this.contractorsService.verifyContractor(id, dto);
    return {
      message: 'Contractor verification status updated',
      data: contractor,
    };
  }
}
