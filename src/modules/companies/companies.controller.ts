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
import { CompaniesService } from './companies.service.js';
import { CreateCompanyDto } from './dto/create-companies.dto.js';
import {
  AdminVerifyCompanyDto,
  UpdateCompanyDto,
} from './dto/update-companies.dto.js';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';

@Controller('companies')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Post()
  @Roles('company', 'admin')
  async create(@Req() req: any, @Body() dto: CreateCompanyDto) {
    const company = await this.companiesService.create(req.user.id, dto);
    return { message: 'Company profile created successfully', data: company };
  }

  @Get('my-profiles')
  @Roles('company')
  async findMyCompanies(@Req() req: any) {
    const data = await this.companiesService.findMyCompanies(req.user.id);
    return { data };
  }

  @Patch(':id')
  @Roles('company', 'admin')
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateCompanyDto,
  ) {
    // Admin bypasses ownership check by passing admin flag, but for simplicity,
    // we'll let service handle ownership based on user id.
    // If Admin wants to edit, we should ideally have a separate admin update method
    // or pass an isAdmin flag. But for now, we'll assume Company edits their own profile.
    const company = await this.companiesService.update(id, req.user.id, dto);
    return { message: 'Company profile updated successfully', data: company };
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
    const result = await this.companiesService.findAll(
      pageNumber,
      limitNumber,
      status,
    );
    return result;
  }

  @Get(':id')
  @Roles('admin')
  async findOne(@Param('id') id: string) {
    const data = await this.companiesService.findOne(id);
    return { data };
  }

  @Patch(':id/verify')
  @Roles('admin')
  async verifyCompany(
    @Param('id') id: string,
    @Body() dto: AdminVerifyCompanyDto,
  ) {
    const company = await this.companiesService.verifyCompany(id, dto);
    return { message: 'Company verification status updated', data: company };
  }
}
