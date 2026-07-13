import { IsEnum, IsOptional } from 'class-validator';
import { DowntimeReasonCode } from '../../generated/prisma/enums';

export class ConfirmReasonDto {
  @IsOptional()
  @IsEnum(DowntimeReasonCode)
  reasonCode?: DowntimeReasonCode;
}
