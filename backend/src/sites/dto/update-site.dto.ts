import { MeaningfulName } from '../../common/meaningful-name';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateSiteDto {
  @IsOptional()
  @MeaningfulName()
  name?: string;
}
