import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateProductOperationDto {
  @IsString()
  skillId: string;

  @IsString()
  siteId: string;

  @IsOptional()
  @IsString()
  secondarySiteId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sequence?: number;
}
