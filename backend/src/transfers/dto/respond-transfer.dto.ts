import { IsBoolean } from 'class-validator';

export class RespondTransferDto {
  @IsBoolean()
  approve: boolean;
}
