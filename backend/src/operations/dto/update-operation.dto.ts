import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class UpdateOperationDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsUUID()
  siteId?: string;

  @IsOptional()
  @IsUUID()
  secondarySiteId?: string;

  @IsOptional()
  @IsUUID()
  skillId?: string;
}
