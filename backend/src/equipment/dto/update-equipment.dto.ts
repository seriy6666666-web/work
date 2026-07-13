import { IsEnum, IsISO8601, IsOptional, IsString, MinLength } from 'class-validator';
import { EquipmentStatus } from '../../generated/prisma/enums';

export class UpdateEquipmentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsEnum(EquipmentStatus)
  status?: EquipmentStatus;

  @IsOptional()
  @IsISO8601()
  nextMaintenanceAt?: string | null;
}
