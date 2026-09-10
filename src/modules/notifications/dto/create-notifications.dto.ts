import { IsNotEmpty, IsOptional, IsString, IsIn } from 'class-validator';

/**
 * Register a device for push notifications.
 */
export class RegisterDeviceDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsOptional()
  @IsString()
  @IsIn(['android', 'ios', 'web'])
  platform?: string;
}
