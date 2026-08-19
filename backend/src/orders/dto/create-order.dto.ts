import { MeaningfulName } from '../../common/meaningful-name';
import { IsDateString, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateOrderDto {
  @MeaningfulName()
  name: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsDateString()
  dueDate: string;

  @IsOptional()
  @IsInt()
  priority?: number;
}
