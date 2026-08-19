import { IsInt, IsISO8601, IsOptional, IsUUID, Min, ValidateIf } from 'class-validator';

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
