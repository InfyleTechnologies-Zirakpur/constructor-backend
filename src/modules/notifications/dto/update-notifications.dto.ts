import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

/**
 * Send a push notification (used by admin or internal services).
 */
export class SendNotificationDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  body: string;

  @IsString()
  @IsIn([
    'new_job',
    'application_update',
    'project_assignment',
    'site_assignment',
    'attendance_event',
    'daily_report_submitted',
    'project_update',
    'admin_announcement',
  ])
  event: string;

  @IsOptional()
  @IsString()
  referenceId?: string;

  /** Target user IDs. If empty with event='admin_announcement', broadcast to all. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  userIds?: string[];
}
