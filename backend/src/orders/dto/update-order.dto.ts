import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { OrderStatus } from '../../generated/prisma/enums';

export class UpdateOrderDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;
}
