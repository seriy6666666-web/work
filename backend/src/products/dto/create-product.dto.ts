import { MeaningfulName } from '../../common/meaningful-name';
import { IsString, MinLength } from 'class-validator';

export class CreateProductDto {
  @MeaningfulName()
  name: string;
}
