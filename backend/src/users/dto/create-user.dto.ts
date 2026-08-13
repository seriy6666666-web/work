import { IsEnum, IsOptional, IsString, IsUUID, Matches, MinLength } from 'class-validator';
import { Role } from '../../generated/prisma/enums';

/**
 * Логин набирают на терминале в цеху, часто в перчатках. Кириллица там означает
 * переключение раскладки на каждый вход, пробелы — незаметные опечатки. Раньше
 * проверялась только длина, и логин из кириллицы спокойно создавался и работал.
 * Импорт из Excel и так делает транслитерацию — ограничение касается ручного ввода.
 */
// Только строчные: иначе «Ivanov» и «ivanov» — два разных человека в системе,
// а на слух и на бумаге они неразличимы.
export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
export const USERNAME_MESSAGE =
  'Логин: строчные латинские буквы, цифры, точка, дефис и подчёркивание. ' +
  'Начинаться должен с буквы или цифры. Например: ivanov.ivan';

export class CreateUserDto {
  @IsString()
  @MinLength(3)
  @Matches(USERNAME_PATTERN, { message: USERNAME_MESSAGE })
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
