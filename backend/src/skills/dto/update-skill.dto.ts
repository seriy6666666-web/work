import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateSkillDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;
}
