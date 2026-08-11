import { IsInt, IsISO8601, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class SetGoalDto {
  @IsUUID()
  userId: string;

  /** День смены (время игнорируется). */
  @IsISO8601()
  date: string;

  @IsInt()
  @Min(0)
  targetQuantity: number;

  @IsOptional()
  @IsString()
  missReason?: string | null;
}
