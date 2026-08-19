import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { CompetencyLevel } from '../../generated/prisma/enums';

const LEVELS = ['LEARNING', 'ALLOWED', 'MENTOR'] as const;

export class SetCompetencyDto {
  @IsUUID()
  userId: string;

  @IsUUID()
  skillId: string;

  /**
   * Ступень допуска. Не указана — допуска нет, запись удаляется.
   *
   * Прежнее поле `canDo` было двоичным, и это не совпадало с тем, как на участке
   * распределяют работу: ученика ставить можно, но рядом с наставником.
   */
  @IsOptional()
  @IsIn(LEVELS)
  level?: CompetencyLevel;
}
