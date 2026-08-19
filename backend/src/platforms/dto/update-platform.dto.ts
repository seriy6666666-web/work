import { MeaningfulName } from '../../common/meaningful-name';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdatePlatformDto {
  @IsOptional()
  @MeaningfulName()
  name?: string;

  @IsOptional()
  @IsString()
  address?: string | null;
}
