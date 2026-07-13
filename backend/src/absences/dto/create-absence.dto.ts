import { IsDateString, IsEnum, IsUUID } from 'class-validator';
import { AbsenceType } from '../../generated/prisma/enums';

export class CreateAbsenceDto {
  @IsUUID()
  userId: string;

  @IsEnum(AbsenceType)
  type: AbsenceType;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;
}
