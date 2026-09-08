import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateApplicationStatusDto {
  @IsIn(['reviewed', 'shortlisted', 'accepted', 'rejected'])
  status: string;

  @IsOptional()
  @IsString()
  rejectionReason?: string;
}
