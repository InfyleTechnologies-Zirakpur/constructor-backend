import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MaterialsController } from './materials.controller.js';
import { MaterialsService } from './materials.service.js';
import { Material } from './entities/material.entity.js';
import { MaterialTransaction } from './entities/material-transaction.entity.js';
import { SiteEngineerAssignment } from '../site-engineers/entities/site-engineer-assignment.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Material,
      MaterialTransaction,
      SiteEngineerAssignment,
    ]),
  ],
  controllers: [MaterialsController],
  providers: [MaterialsService],
  exports: [MaterialsService],
})
export class MaterialsModule {}
