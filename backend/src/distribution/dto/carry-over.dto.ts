import { IsEnum, IsISO8601, IsOptional, IsUUID } from 'class-validator';
import { DowntimeReasonCode } from '../../generated/prisma/enums';

/**
 * Перенос остатка задания. Человека сняли посреди смены или он не успел —
 * сделанное остаётся за ним, а остаток уходит дальше.
 */
export class CarryOverDto {
  /** На какой день переносим. Не указан — завтра. */
  @IsOptional()
  @IsISO8601()
  date?: string;

  /** На кого переносим. Не указан — на того же человека. */
  @IsOptional()
  @IsUUID()
  userId?: string;

  /**
   * Почему не доделано. По умолчанию «переведён на другую работу» — самый частый
   * случай. Причина закрывает исходное назначение как уважительное, поэтому
   * выполнение у человека не портится.
   */
  @IsOptional()
  @IsEnum(DowntimeReasonCode)
  reasonCode?: DowntimeReasonCode;

  @IsOptional()
  reasonComment?: string;
}
