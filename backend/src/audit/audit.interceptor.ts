import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import type { Response } from 'express';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedRequest } from '../auth/jwt.strategy';

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);
const SENSITIVE_FIELDS = ['password', 'passwordHash'];

function sanitizeBody(body: unknown): Prisma.InputJsonValue | undefined {
  if (!body || typeof body !== 'object') {
    return undefined;
  }
  const clone = { ...(body as Record<string, unknown>) };
  for (const field of SENSITIVE_FIELDS) {
    delete clone[field];
  }
  return clone as Prisma.InputJsonValue;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!MUTATING_METHODS.has(request.method)) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse<Response>();
        this.prisma.auditLog
          .create({
            data: {
              userId: request.user?.sub ?? null,
              username: request.user?.username ?? null,
              role: request.user?.role ?? null,
              method: request.method,
              path: request.originalUrl ?? request.url,
              statusCode: response.statusCode,
              body: sanitizeBody(request.body),
            },
          })
          .catch(() => undefined);
      }),
    );
  }
}
