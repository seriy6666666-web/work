import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateSiteDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;
}
