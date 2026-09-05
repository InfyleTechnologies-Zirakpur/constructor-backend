import { IsNotEmpty, IsUUID } from 'class-validator';

export class AssignEngineerDto {
  @IsNotEmpty()
  @IsUUID()
  userId: string;
}
