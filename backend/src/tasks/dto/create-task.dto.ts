import { IsISO8601, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateTaskDto {
  @IsString()
  @MinLength(1)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsISO8601()
  dueDate?: string;

  /** Кому задача. Если не указано — себе. */
  @IsOptional()
  @IsUUID()
  assigneeId?: string;
}
