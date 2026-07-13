import { IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class UpdateMaterialDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  unit?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  lowStockThreshold?: number;
}
