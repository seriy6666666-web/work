import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class UpdateOperationDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  /** Сколько участок должен сделать за смену. Не задано — план на смену не показываем. */
  @IsOptional()
  @IsInt()
  @Min(1)
  dailyQuantity?: number;


  @IsOptional()
  @IsUUID()
  siteId?: string;

  @IsOptional()
  @IsUUID()
  secondarySiteId?: string;

  @IsOptional()
  @IsUUID()
  operationTypeId?: string;

  /** С адреса операции списываются материалы — его меняют, если работа ушла на другую площадку. */
  @IsOptional()
  @IsUUID()
  platformId?: string;
}
