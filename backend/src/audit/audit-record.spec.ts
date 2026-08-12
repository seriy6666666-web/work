import { Role } from '../generated/prisma/enums';
import type { AuthenticatedRequest } from '../auth/jwt.strategy';
import { buildAuditData, shouldRecord } from './audit-record';

function req(over: Partial<AuthenticatedRequest> & { body?: unknown } = {}) {
  return {
    method: 'POST',
    originalUrl: '/feedback',
    user: { sub: 'u-1', username: 'worker', role: Role.WORKER, siteId: 's-1' },
    body: {},
    ...over,
  } as unknown as AuthenticatedRequest;
}

describe('shouldRecord', () => {
  it('пишет мутирующие запросы', () => {
    for (const m of ['POST', 'PATCH', 'PUT', 'DELETE']) {
      expect(shouldRecord(m, 200)).toBe(true);
    }
  });

  it('не пишет успешные чтения — иначе журнал утонет в них', () => {
    expect(shouldRecord('GET', 200)).toBe(false);
  });

  it('пишет отказы даже для чтений: это следы попыток залезть не туда', () => {
    expect(shouldRecord('GET', 403)).toBe(true);
    expect(shouldRecord('GET', 401)).toBe(true);
  });
});

describe('buildAuditData', () => {
  it('вырезает пароль из тела', () => {
    const data = buildAuditData(
      req({ originalUrl: '/users', body: { username: 'ivan', password: 'hunter2' } }),
      201,
    );
    expect(data.body).toEqual({ username: 'ivan' });
  });

  it('сохраняет автора и тело для подписанного обращения', () => {
    const data = buildAuditData(req({ body: { message: 'сломалась кнопка', anonymous: false } }), 201);
    expect(data.username).toBe('worker');
    expect(data.role).toBe(Role.WORKER);
    expect(data.body).toEqual({ message: 'сломалась кнопка', anonymous: false });
  });

  // Ключевая гарантия: администратор читает и обращения, и журнал аудита. Если журнал
  // сохранит автора или текст, анонимное обращение сводится с автором по тексту.
  it('для анонимного обращения не пишет ни автора, ни роль, ни тело', () => {
    const data = buildAuditData(req({ body: { message: 'начальник орёт', anonymous: true } }), 201);
    expect(data.userId).toBeNull();
    expect(data.username).toBeNull();
    expect(data.role).toBeNull();
    expect(data.body).toBeUndefined();
    // Факт обращения при этом остаётся в журнале.
    expect(data.path).toBe('/feedback');
    expect(data.statusCode).toBe(201);
  });

  it('анонимность распознаётся и когда в пути есть строка запроса', () => {
    const data = buildAuditData(
      req({ originalUrl: '/feedback?from=tasks', body: { anonymous: true } }),
      201,
    );
    expect(data.username).toBeNull();
  });

  it('флаг anonymous в других разделах автора не скрывает', () => {
    const data = buildAuditData(
      req({ originalUrl: '/orders', body: { name: 'Партия', anonymous: true } }),
      201,
    );
    expect(data.username).toBe('worker');
  });
});
