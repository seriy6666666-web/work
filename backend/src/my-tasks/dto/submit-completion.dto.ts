import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { DowntimeReasonCode } from '../../generated/prisma/enums';

export class SubmitCompletionDto {
  @IsInt()
  @Min(0)
  doneQuantity: number;

  @IsOptional()
  @IsEnum(DowntimeReasonCode)
  reasonCode?: DowntimeReasonCode;

  @IsOptional()
  @IsString()
  reasonComment?: string;
}
