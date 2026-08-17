import { MeaningfulName } from '../../common/meaningful-name';

/**
 * Навык — только квалификация. Норма выработки отсюда уехала на операцию:
 * у «Пайки» единой нормы быть не может, пайка шин и пайка проводов идут с
 * разной скоростью.
 */
export class CreateSkillDto {
  @MeaningfulName()
  name: string;
}
