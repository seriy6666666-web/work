import { IsDateString, IsUUID } from 'class-validator';

export class CreateTransferDto {
  @IsUUID()
  userId: string;

  @IsUUID()
  toSiteId: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;
}
