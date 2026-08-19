import { IsInt, IsISO8601, IsOptional, IsUUID, Min } from 'class-validator';

export class CreateAssignmentDto {
  @IsUUID()
  operationId: string;

  @IsUUID()
  userId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  assignedQuantity?: number;

  /**
   * День, на который выдаётся задание. Не указан — сегодня.
   * Начальник участка расставляет людей вперёд, поэтому дата может быть будущей.
   */
  @IsOptional()
  @IsISO8601()
  date?: string;
}
