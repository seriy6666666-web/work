import { IsInt, IsISO8601, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateOrderFromProductDto {
  @IsString()
  productId: string;

  /** Площадка, на которой производится заказ (для списания материалов). */
  @IsUUID()
  platformId: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsISO8601()
  dueDate: string;

  @IsOptional()
  @IsInt()
  priority?: number;
}
