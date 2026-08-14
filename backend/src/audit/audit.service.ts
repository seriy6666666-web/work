import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';

const PAGE_SIZE = 50;

/**
 * Сколько хранить журнал действий. Год — чтобы разбор давнего спора «кто снял
 * человека с операции» упирался в память людей, а не в отсутствие записей.
 * `AUDIT_RETENTION_DAYS=0` отключает чистку совсем.
 */
const DEFAULT_RETENTION_DAYS = 365;

/** Удаляем частями: одним запросом на большой таблице чистка держала бы блокировку. */
const DELETE_BATCH = 5000;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Первую чистку откладываем, чтобы не соревноваться со стартом приложения. */
const FIRST_RUN_DELAY_MS = 60_000;

@Injectable()
export class AuditService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuditService.name);
  private timers: NodeJS.Timeout[] = [];

  constructor(private prisma: PrismaService) {}

  /**
   * Журнал пишется на каждое изменение и на каждый отказ, то есть растёт всё
   * время работы завода и никогда не уменьшается. Сам по себе он маленький, но
   * бесконечный: за неделю тестов набежало больше четырёх тысяч записей при
   * десятке человек. На смене в сотню это уже другой порядок, а места на сервере
   * больше не становится.
   *
   * Чистим раз в сутки, а не при каждом запросе: удаление — не то, что стоит
   * делать в обработчике, которого ждёт человек.
   */
  onModuleInit() {
    const days = this.retentionDays();
    if (days <= 0) {
      this.logger.log('Чистка журнала действий отключена (AUDIT_RETENTION_DAYS=0)');
      return;
    }
    this.logger.log(`Журнал действий хранится ${days} дн., чистка раз в сутки`);

    const run = () => {
      void this.purgeOldEntries(days).catch((err) =>
        this.logger.error(`Не удалось почистить журнал действий: ${String(err)}`),
      );
    };
    // unref: фоновая уборка не должна мешать процессу завершиться.
    this.timers.push(setTimeout(run, FIRST_RUN_DELAY_MS).unref());
    this.timers.push(setInterval(run, DAY_MS).unref());
  }

  onModuleDestroy() {
    for (const t of this.timers) clearTimeout(t as NodeJS.Timeout);
    this.timers = [];
  }

  private retentionDays(): number {
    const raw = process.env.AUDIT_RETENTION_DAYS;
    if (raw === undefined || raw.trim() === '') return DEFAULT_RETENTION_DAYS;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed < 0) {
      this.logger.warn(
        `AUDIT_RETENTION_DAYS=«${raw}» — не число, беру ${DEFAULT_RETENTION_DAYS} дн.`,
      );
      return DEFAULT_RETENTION_DAYS;
    }
    return Math.floor(parsed);
  }

  /** Удалить записи старше `days` дней. Возвращает, сколько удалено. */
  async purgeOldEntries(days: number): Promise<number> {
    const cutoff = new Date(Date.now() - days * DAY_MS);
    let removed = 0;

    for (;;) {
      const batch = await this.prisma.auditLog.findMany({
        where: { createdAt: { lt: cutoff } },
        select: { id: true },
        take: DELETE_BATCH,
      });
      if (batch.length === 0) break;

      const { count } = await this.prisma.auditLog.deleteMany({
        where: { id: { in: batch.map((e) => e.id) } },
      });
      removed += count;
      if (batch.length < DELETE_BATCH) break;
    }

    if (removed > 0) {
      this.logger.log(`Журнал действий: удалено ${removed} записей старше ${days} дн.`);
    }
    return removed;
  }

  async list(query: AuditLogQueryDto) {
    const page = query.page ?? 1;
    const where = {
      userId: query.userId,
      method: query.method,
      createdAt:
        query.from || query.to
          ? {
              gte: query.from ? new Date(query.from) : undefined,
              lte: query.to ? new Date(query.to) : undefined,
            }
          : undefined,
    };

    const [entries, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { entries, total, page, pageSize: PAGE_SIZE };
  }
}
