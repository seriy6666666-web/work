import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { MeaningfulName } from '../../common/meaningful-name';

export class CreateOperationTypeDto {
  @MeaningfulName()
  name: string;

  /** Норма выработки за смену. Не задана — выработку по норме не считаем. */
  @IsOptional()
  @IsInt()
  @Min(1)
  norm?: number;

  /** Требуемая квалификация. Не указана — операцию может выполнять любой. */
  @IsOptional()
  @IsUUID()
  skillId?: string;
}
