import { IsBoolean, IsUUID } from 'class-validator';

export class SetCompetencyDto {
  @IsUUID()
  userId: string;

  @IsUUID()
  skillId: string;

  @IsBoolean()
  canDo: boolean;
}
