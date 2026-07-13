import { IsInt, Min } from 'class-validator';

export class UpdateAssignmentDto {
  @IsInt()
  @Min(1)
  assignedQuantity: number;
}
