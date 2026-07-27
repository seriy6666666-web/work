import { ArrayUnique, IsArray, IsUUID } from 'class-validator';

export class SetPlatformsDto {
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  platformIds: string[];
}
