import { ArgumentsHost, Catch, HttpException, Injectable } from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedRequest } from '../auth/jwt.strategy';
import { buildAuditData, shouldRecord } from './audit-record';

/**
 * Пишет в журнал ПРОВАЛИВШИЕСЯ запросы, после чего отдаёт ответ штатным способом.
 *
 * Отдельный фильтр нужен потому, что порядок в Nest такой:
 * guard'ы → интерцепторы → обработчик. RolesGuard отклоняет запрос ещё до
 * интерцептора, поэтому AuditInterceptor при 403 не вызывается и отказы не
 * попадали в журнал вообще: ни брутфорс, ни попытки залезть в чужой раздел.
 * Фильтр же видит любое исключение, откуда бы оно ни пришло.
 */
@Injectable()
@Catch()
export class AuditExceptionFilter extends BaseExceptionFilter {
  constructor(
    private prisma: PrismaService,
    adapterHost: HttpAdapterHost,
  ) {
    super(adapterHost.httpAdapter);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() === 'http') {
      const request = host.switchToHttp().getRequest<AuthenticatedRequest>();
      const statusCode = exception instanceof HttpException ? exception.getStatus() : 500;

      if (shouldRecord(request.method, statusCode)) {
        this.prisma.auditLog
          .create({ data: buildAuditData(request, statusCode) })
          .catch(() => undefined);
      }
    }

    // Ответ клиенту формирует Nest — поведение при ошибках не меняем.
    super.catch(exception, host);
  }
}
