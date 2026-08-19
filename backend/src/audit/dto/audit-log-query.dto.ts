import { Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Min } from 'class-validator';

const METHODS = ['POST', 'PATCH', 'PUT', 'DELETE'] as const;

/**
 * По чему можно упорядочить журнал.
 *
 * Сортировка здесь серверная, а не в браузере: записи приходят страницами по 50,
 * и порядок, наведённый в браузере, переставил бы только текущую страницу — а
 * выглядел бы как порядок всего журнала. Это хуже, чем отсутствие сортировки.
 */
const SORT_FIELDS = ['createdAt', 'username', 'method', 'path', 'statusCode'] as const;

export class AuditLogQueryDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsIn(METHODS)
  method?: (typeof METHODS)[number];

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsIn(SORT_FIELDS)
  sort?: (typeof SORT_FIELDS)[number];

  @IsOptional()
  @IsIn(['asc', 'desc'])
  dir?: 'asc' | 'desc';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;
}
