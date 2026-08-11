import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateHandoverDto {
  @IsString()
  @MinLength(1)
  message: string;

  /** Кому передаём дела. Если не указан — определяем старшего следующей смены. */
  @IsOptional()
  @IsUUID()
  toUserId?: string;
}
