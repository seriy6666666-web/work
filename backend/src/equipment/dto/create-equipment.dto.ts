import { IsISO8601, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateEquipmentDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsISO8601()
  nextMaintenanceAt?: string;
}
