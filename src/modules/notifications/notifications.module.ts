import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';
import { FirebaseProvider } from './firebase.provider.js';
import { Notification } from './entities/notification.entity.js';
import { DeviceToken } from './entities/device-token.entity.js';
import { User } from '../users/entities/user.entity.js';
import { Contractor } from '../contractors/entities/contractor.entity.js';
import { SiteEngineerAssignment } from '../site-engineers/entities/site-engineer-assignment.entity.js';
import {
  NOTIFICATION_QUEUE,
  NOTIFICATION_FANOUT_QUEUE,
} from './notification-queue.constants.js';
import {
  NotificationProcessor,
  NotificationFanoutProcessor,
} from './notification.processor.js';

// Same QUEUE_ENABLED flag as app.module.ts: without Redis there is no
// Bull connection, so queues/workers are skipped. NotificationsService
// injects queues as @Optional() and falls back to direct sending.
const queueEnabled = process.env.QUEUE_ENABLED !== 'false';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      Notification,
      DeviceToken,
      User,
      Contractor,
      SiteEngineerAssignment,
    ]),
    ...(queueEnabled
      ? [
          BullModule.registerQueue(
            {
              name: NOTIFICATION_QUEUE,
            },
            {
              name: NOTIFICATION_FANOUT_QUEUE,
            },
          ),
        ]
      : []),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    FirebaseProvider,
    ...(queueEnabled
      ? [NotificationProcessor, NotificationFanoutProcessor]
      : []),
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
