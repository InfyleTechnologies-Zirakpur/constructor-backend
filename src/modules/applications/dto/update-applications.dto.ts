import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateApplicationStatusDto {
  @IsIn(['reviewed', 'shortlisted', 'accepted', 'rejected'])
  status: string;

  /**
   * Optional remark from the company explaining the decision.
   * Works for all statuses (shortlisted, accepted, rejected, reviewed).
   * Stored as companyRemark on the application and sent as the first message in the conversation.
   */
  @IsOptional()
  @IsString()
  remark?: string;
}
