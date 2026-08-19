import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class CreateOperationDto {
  @IsInt()
  @Min(1)
  quantity: number;

  /** Сколько участок должен сделать за смену. Не задано — план на смену не показываем. */
  @IsOptional()
  @IsInt()
  @Min(1)
  dailyQuantity?: number;


  @IsUUID()
  siteId: string;

  @IsOptional()
  @IsUUID()
  secondarySiteId?: string;

  @IsUUID()
  operationTypeId: string;

  /** Адрес, где операцию делают. Не указан — берётся адрес заказа. */
  @IsOptional()
  @IsUUID()
  platformId?: string;
}
