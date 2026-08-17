import { IsOptional } from 'class-validator';
import { MeaningfulName } from '../../common/meaningful-name';

export class UpdateSkillDto {
  @IsOptional()
  @MeaningfulName()
  name?: string;
}
