import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class CreateAuditLogDto {
  @IsString() @IsNotEmpty() action: string;
  @IsString() @IsNotEmpty() entityType: string;
  @IsString() @IsNotEmpty() entityId: string;
  @IsOptional() metadata?: any;
}
