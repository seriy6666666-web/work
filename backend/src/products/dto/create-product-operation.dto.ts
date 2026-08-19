import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateProductOperationDto {
  @IsString()
  operationTypeId: string;

  /** Сколько штук этой операции на одно изделие. Резка провода — 2. */
  @IsOptional()
  @IsInt()
  @Min(1)
  perUnit?: number;

  @IsString()
  siteId: string;

  @IsOptional()
  @IsString()
  secondarySiteId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sequence?: number;
}
