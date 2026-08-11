import { IsNumber } from 'class-validator';

export class AdjustStockDto {
  /** Знаковое изменение: + приход, − расход. */
  @IsNumber()
  delta: number;
}
