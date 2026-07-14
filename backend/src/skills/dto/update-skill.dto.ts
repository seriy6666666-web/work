import { IsNumber, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class UpdateSkillDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  /** Норма выработки за смену (годных единиц). null очищает норму. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  norm?: number | null;
}
