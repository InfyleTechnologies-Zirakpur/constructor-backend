import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExpensesController } from './expenses.controller.js';
import { ExpensesService } from './expenses.service.js';
import { Expense } from './entities/expense.entity.js';
import { SiteEngineerAssignment } from '../site-engineers/entities/site-engineer-assignment.entity.js';
import { Contractor } from '../contractors/entities/contractor.entity.js';
import { Project } from '../projects/entities/project.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Expense,
      SiteEngineerAssignment,
      Contractor,
      Project,
    ]),
  ],
  controllers: [ExpensesController],
  providers: [ExpensesService],
  exports: [ExpensesService],
})
export class ExpensesModule {}
