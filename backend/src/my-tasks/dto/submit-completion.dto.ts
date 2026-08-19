import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { DowntimeReasonCode } from '../../generated/prisma/enums';

export class SubmitCompletionDto {
  @IsInt()
  @Min(0)
  doneQuantity: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  defectQuantity?: number;

  @IsOptional()
  @IsEnum(DowntimeReasonCode)
  reasonCode?: DowntimeReasonCode;

  @IsOptional()
  @IsString()
  reasonComment?: string;

  /**
   * Ключ отправки. Планшет присылает один и тот же, пока пытается достучаться,
   * поэтому повтор после оборвавшейся связи не тратит исправление.
   */
  @IsOptional()
  @IsString()
  requestId?: string;
}
