import { IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

export class UpsertStockDto {
  @IsUUID()
  materialId: string;

  @IsUUID()
  platformId: string;

  @IsUUID()
  projectId: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  lowStockThreshold?: number;
}
