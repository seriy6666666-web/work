import { IsInt, IsISO8601, IsOptional, IsUUID, Min, ValidateIf } from 'class-validator';

export class CreateOperationDto {
  @IsInt()
  @Min(1)
  quantity: number;

  /** Сколько участок должен сделать за смену. Не задано — план на смену не показываем. */
  @IsOptional()
  @IsInt()
  @Min(1)
  dailyQuantity?: number;

  /** Сколько штук операции на одно изделие. */
  @IsOptional()
  @IsInt()
  @Min(1)
  perUnit?: number;


  /**
   * К какому дню участок должен сдать операцию. Не задан — начальник участка
   * видит срок заказа, как было раньше.
   */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsISO8601()
  dueDate?: string | null;

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
