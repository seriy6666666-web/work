import { IsNumber } from 'class-validator';

export class AdjustMaterialDto {
  /** Signed change: positive to receive stock, negative to consume. */
  @IsNumber()
  delta: number;
}
