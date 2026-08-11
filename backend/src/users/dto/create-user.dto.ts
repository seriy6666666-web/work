import { IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { Role } from '../../generated/prisma/enums';

export class CreateUserDto {
  @IsString()
  @MinLength(3)
  username: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @MinLength(1)
  fullName: string;

  @IsEnum(Role)
  role: Role;

  @IsOptional()
  @IsUUID()
  siteId?: string;

  /** Руководитель — кому уходят уведомления об отсутствии сотрудника. */
  @IsOptional()
  @IsUUID()
  managerId?: string;
}
