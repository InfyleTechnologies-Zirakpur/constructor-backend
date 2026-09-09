import { IsIn, IsOptional } from 'class-validator';

/**
 * Update report status: submit or review.
 */
export class UpdateReportStatusDto {
  @IsIn(['submitted', 'reviewed'])
  status: string;

  @IsOptional()
  remarks?: string;
}
