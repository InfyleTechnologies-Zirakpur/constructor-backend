import { IsIn, IsOptional, IsString } from 'class-validator';

/**
 * Update attendance status (Admin/Contractor can mark absent, half_day, on_leave).
 */
export class UpdateAttendanceDto {
  @IsOptional()
  @IsIn(['present', 'half_day', 'absent', 'on_leave'])
  status?: string;
}

/**
 * Update labour record DTO — partial updates.
 */
export class UpdateLabourRecordDto {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  remarks?: string;
}
