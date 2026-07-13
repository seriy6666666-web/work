import { IsString, MinLength } from 'class-validator';

export class CreateSkillDto {
  @IsString()
  @MinLength(1)
  name: string;
}
