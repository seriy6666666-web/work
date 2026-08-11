import { IsEnum, IsISO8601, IsUUID } from 'class-validator';
import { ShiftType } from '../../generated/prisma/enums';

export class SetShiftLeadDto {
  @IsUUID()
  siteId: string;

  @IsUUID()
  userId: string;

  @IsISO8601()
  date: string;

  @IsEnum(ShiftType)
  type: ShiftType;
}
