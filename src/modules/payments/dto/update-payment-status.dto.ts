import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdatePaymentStatusDto {
  @IsNotEmpty()
  @IsIn(['pending', 'processing', 'completed', 'failed', 'refunded'])
  status: string;

  @IsOptional()
  @IsString()
  transactionId?: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}
