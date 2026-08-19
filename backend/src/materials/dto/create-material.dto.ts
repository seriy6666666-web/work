import { MeaningfulName } from '../../common/meaningful-name';
import { IsString, MinLength } from 'class-validator';

export class CreateMaterialDto {
  @MeaningfulName()
  name: string;

  @IsString()
  @MinLength(1)
  unit: string;
}
