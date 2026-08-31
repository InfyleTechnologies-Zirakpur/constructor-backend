import { Module } from '@nestjs/common';
import { SiteEngineersController } from './site-engineers.controller.js';
import { SiteEngineersService } from './site-engineers.service.js';

@Module({
  controllers: [SiteEngineersController],
  providers: [SiteEngineersService],
})
export class SiteEngineersModule {}
