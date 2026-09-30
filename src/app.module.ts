import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
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
import { ConversationsModule } from './modules/conversations/conversations.module.js';

import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './modules/auth/strategies/jwt.strategy.js';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl =
          config.get<string>('REDIS_URL') || 'redis://localhost:6379';
        try {
          const parsed = new URL(redisUrl);
          return {
            connection: {
              host: parsed.hostname || 'localhost',
              port: parsed.port ? parseInt(parsed.port, 10) : 6379,
              username: parsed.username || undefined,
              password: parsed.password || undefined,
              maxRetriesPerRequest: null,
              enableOfflineQueue: true,
              retryStrategy: (times: number) => Math.min(times * 1000, 10000),
            },
          };
        } catch {
          return {
            connection: {
              host: 'localhost',
              port: 6379,
              maxRetriesPerRequest: null,
              enableOfflineQueue: true,
              retryStrategy: (times: number) => Math.min(times * 1000, 10000),
            },
          };
        }
      },
    }),
    PassportModule,
    // Rate limiting: global defaults (overridable per-route with @Throttle)
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000, // 1 minute window
        limit: 60,  // 60 requests per minute default
      },
      {
        name: 'auth',
        ttl: 60000, // 1 minute window
        limit: 10,  // 10 auth requests per minute
      },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret && process.env.NODE_ENV === 'production') {
          throw new Error('JWT_SECRET must be set in production');
        }
        const expiresIn = config.get<string>('JWT_EXPIRES_IN') || '7d';
        return {
          secret: secret ?? 'dev-secret-key-not-for-production',
          signOptions: { expiresIn: (expiresIn as any) },
        };
      },
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
    ConversationsModule,
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
    // Apply ThrottlerGuard globally — routes use @SkipThrottle() to opt out
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}

