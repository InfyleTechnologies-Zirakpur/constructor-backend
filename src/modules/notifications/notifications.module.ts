import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { FirebaseProvider } from './firebase.provider.js';
import { Notification } from './entities/notification.entity.js';
import { DeviceToken } from './entities/device-token.entity.js';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Notification, DeviceToken]),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, FirebaseProvider],
  exports: [NotificationsService],
})
export class NotificationsModule {}
