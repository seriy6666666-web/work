import { IsNumber, IsUUID, Min } from 'class-validator';

export class SetOperationMaterialDto {
  @IsUUID()
  materialId: string;

  @IsNumber()
  @Min(0)
  quantityPerUnit: number;
}
