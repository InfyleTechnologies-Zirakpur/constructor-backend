import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { DatabaseModule } from './database/database.module.js';
import { AuthController } from './modules/auth/auth.controller.js';
import { AuthService } from './modules/auth/auth.service.js';
import { CalculatorsController } from './modules/calculators/calculators.controller.js';
import { CalculatorsService } from './modules/calculators/calculators.service.js';
import { JobsController } from './modules/jobs/jobs.controller.js';
import { JobsService } from './modules/jobs/jobs.service.js';
import { ProjectsController } from './modules/projects/projects.controller.js';
import { ProjectsService } from './modules/projects/projects.service.js';
import { SitesController } from './modules/sites/sites.controller.js';
import { SitesService } from './modules/sites/sites.service.js';
import { AuthorizationModule } from './modules/authorization/authorization.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { CompaniesModule } from './modules/companies/companies.module.js';
import { ContractorsModule } from './modules/contractors/contractors.module.js';
import { ProjectSitesModule } from './modules/project-sites/project-sites.module.js';
import { SiteEngineersModule } from './modules/site-engineers/site-engineers.module.js';
import { ApplicationsModule } from './modules/applications/applications.module.js';
import { AttendanceModule } from './modules/attendance/attendance.module.js';
import { MaterialsModule } from './modules/materials/materials.module.js';
import { ExpensesModule } from './modules/expenses/expenses.module.js';
import { ReportsModule } from './modules/reports/reports.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { DocumentsModule } from './modules/documents/documents.module.js';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module.js';
import { WorkerAppModule } from './modules/worker-app/worker-app.module.js';

import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './modules/auth/strategies/jwt.strategy.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret-key',
      signOptions: { expiresIn: '7d' },
    }),
    AuthorizationModule,
    UsersModule,
    CompaniesModule,
    ContractorsModule,
    ProjectSitesModule,
    SiteEngineersModule,
    ApplicationsModule,
    AttendanceModule,
    MaterialsModule,
    ExpensesModule,
    ReportsModule,
    NotificationsModule,
    DocumentsModule,
    AuditLogsModule,
    WorkerAppModule,
  ],
  controllers: [
    AppController,
    AuthController,
    JobsController,
    CalculatorsController,
    ProjectsController,
    SitesController,
  ],
  providers: [
    AppService,
    AuthService,
    JwtStrategy,
    JobsService,
    CalculatorsService,
    ProjectsService,
    SitesService,
  ],
})
export class AppModule {}
