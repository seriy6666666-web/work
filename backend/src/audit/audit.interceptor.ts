import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedRequest } from '../auth/jwt.strategy';
import { buildAuditData, shouldRecord } from './audit-record';

/**
 * Пишет в журнал УСПЕШНЫЕ запросы. Отказы и ошибки сюда не попадают: guard'ы
 * (в том числе RolesGuard) срабатывают раньше интерцепторов, поэтому при 403
 * этот код не вызывается вовсе. Провалы пишет AuditExceptionFilter.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      tap(() => {
        const statusCode = response.statusCode;
        if (!shouldRecord(request.method, statusCode)) return;
        this.prisma.auditLog
          .create({ data: buildAuditData(request, statusCode) })
          .catch(() => undefined);
      }),
    );
  }
}
