import { IsInt, IsOptional, IsUUID, Min, ValidateIf } from 'class-validator';
import { MeaningfulName } from '../../common/meaningful-name';

export class UpdateOperationTypeDto {
  @IsOptional()
  @MeaningfulName()
  name?: string;

  /** null — снять норму. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(1)
  norm?: number | null;

  /** null — «навык не требуется, это все умеют». */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  skillId?: string | null;
}
