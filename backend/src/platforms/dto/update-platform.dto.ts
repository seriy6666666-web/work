import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdatePlatformDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  address?: string | null;
}
