import { IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class CreateSkillDto {
  @IsString()
  @MinLength(1)
  name: string;

  /** Норма выработки за смену (годных единиц). null — норма не задана. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  norm?: number | null;
}
