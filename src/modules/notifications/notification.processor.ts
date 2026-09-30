import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import {
  NOTIFICATION_QUEUE,
  NOTIFICATION_FANOUT_QUEUE,
} from './notification-queue.constants.js';
import { NotificationsService } from './notifications.service.js';
import {
  NotificationJobData,
  NotificationFanoutJobData,
} from './dto/notification-job.dto.js';

@Processor(NOTIFICATION_QUEUE)
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(private readonly notificationsService: NotificationsService) {
    super();
  }

  async process(job: Job<NotificationJobData>): Promise<any> {
    this.logger.log(
      `[P1 Queue] Processing job ${job.id} (attempt ${job.attemptsMade + 1}/${job.opts.attempts || 3}) for user ${job.data.recipientId}`,
    );
    return this.notificationsService.executeNotificationJob(job.data);
  }
}

@Processor(NOTIFICATION_FANOUT_QUEUE)
export class NotificationFanoutProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationFanoutProcessor.name);

  constructor(private readonly notificationsService: NotificationsService) {
    super();
  }

  async process(job: Job<NotificationFanoutJobData>): Promise<any> {
    this.logger.log(
      `[P3 Fanout Queue] Processing fanout job ${job.id} for ${job.data.recipientIds?.length || 0} users`,
    );
    return this.notificationsService.executeFanoutNotificationJob(job.data);
  }
}
