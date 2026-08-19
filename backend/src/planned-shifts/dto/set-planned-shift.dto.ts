import { IsEnum, IsInt, IsUUID, Max, Min } from 'class-validator';
import { ShiftType } from '../../generated/prisma/enums';

export class SetPlannedShiftDto {
  @IsUUID()
  userId: string;

  /**
   * День недели: 0 — понедельник, 6 — воскресенье.
   *
   * Дат здесь нет намеренно: график на участке постоянный и повторяется, а
   * расставлять его заново каждую календарную неделю — работа, которой не
   * должно быть.
   */
  @IsInt()
  @Min(0)
  @Max(6)
  weekday: number;

  @IsEnum(ShiftType)
  type: ShiftType;
}
