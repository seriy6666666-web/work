import { Prisma } from '../generated/prisma/client';
import type { AuthenticatedRequest } from '../auth/jwt.strategy';

const MUTATING_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);
const SENSITIVE_FIELDS = ['password', 'passwordHash', 'newPassword'];

/** Отказы в доступе пишем при любом методе: это следы попыток залезть не туда. */
const DENIED = new Set([401, 403]);

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

/**
 * Анонимное обращение: в таблице Feedback автор не сохраняется намеренно, но журнал
 * аудита пишет и автора запроса, и тело. Обращения и журнал читает один и тот же
 * человек — администратор, — значит сводит их по тексту сообщения и получает автора.
 * Анонимность обнуляется.
 *
 * Поэтому для таких запросов не пишем ни автора, ни тело: факт обращения в журнале
 * остаётся, а содержимое уже лежит в Feedback, дублировать его незачем.
 */
function isAnonymousFeedback(request: AuthenticatedRequest): boolean {
  if (request.method !== 'POST') return false;
  const path = request.originalUrl ?? request.url;
  if (!path.startsWith('/feedback')) return false;
  return (request.body as { anonymous?: unknown } | undefined)?.anonymous === true;
}

/** Успешные чтения не пишем — журнал утонет в них и станет бесполезным. */
export function shouldRecord(method: string, statusCode: number): boolean {
  return MUTATING_METHODS.has(method) || DENIED.has(statusCode);
}

export function buildAuditData(
  request: AuthenticatedRequest,
  statusCode: number,
): Prisma.AuditLogUncheckedCreateInput {
  const anonymous = isAnonymousFeedback(request);
  return {
    userId: anonymous ? null : (request.user?.sub ?? null),
    username: anonymous ? null : (request.user?.username ?? null),
    role: anonymous ? null : (request.user?.role ?? null),
    method: request.method,
    path: request.originalUrl ?? request.url,
    statusCode,
    body: anonymous ? undefined : sanitizeBody(request.body),
  };
}
