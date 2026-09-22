import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class CreateMessageDto {
  @IsString()
  @IsNotEmpty()
  text: string;
}

export class CreateConversationDto {
  @IsUUID()
  @IsNotEmpty()
  seekerId: string;

  @IsUUID()
  @IsNotEmpty()
  jobId: string;

  @IsOptional()
  @IsUUID()
  applicationId?: string;
}