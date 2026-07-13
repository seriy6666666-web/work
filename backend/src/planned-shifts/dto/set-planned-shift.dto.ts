import { IsDateString, IsEnum, IsUUID } from 'class-validator';
import { ShiftType } from '../../generated/prisma/enums';

export class SetPlannedShiftDto {
  @IsUUID()
  userId: string;

  /** Calendar day (YYYY-MM-DD or full ISO); time component is ignored. */
  @IsDateString()
  date: string;

  @IsEnum(ShiftType)
  type: ShiftType;
}
