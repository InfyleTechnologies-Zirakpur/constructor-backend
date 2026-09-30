import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export interface NotificationJobData {
  idempotencyKey?: string;
  recipientId: string;
  type: string;
  title: string;
  message: string;
  referenceId?: string;
  data?: Record<string, string>;
  priority?: 'P1' | 'P3';
}

export interface NotificationFanoutJobData {
  idempotencyKey?: string;
  recipientIds: string[];
  type: string;
  title: string;
  message: string;
  referenceId?: string;
  data?: Record<string, string>;
  priority?: 'P1' | 'P3';
}

export class AdminSendNotificationDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  body: string;

  @IsString()
  @IsOptional()
  event?: string;

  @IsArray()
  @IsUUID('all', { each: true })
  @IsOptional()
  userIds?: string[];

  @IsString()
  @IsOptional()
  referenceId?: string;
}
