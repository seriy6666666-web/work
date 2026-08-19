import { MeaningfulName } from '../../common/meaningful-name';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateMaterialDto {
  @IsOptional()
  @MeaningfulName()
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  unit?: string;
}
