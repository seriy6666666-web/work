import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class CreateAssignmentDto {
  @IsUUID()
  operationId: string;

  @IsUUID()
  userId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  assignedQuantity?: number;
}
