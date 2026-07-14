import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus } from '../generated/prisma/enums';
import { periodStart, type StatsPeriod } from './dto/stats-period.dto';

export interface SiteRankingEntry {
  userId: string;
  fullName: string;
  completionRate: number | null;
  /** Выработка относительно нормы операции (годных / сумма норм смен). null — норм нет. */
  normRate: number | null;
  excusedCount: number;
  totalCount: number;
  defectCount: number;
  defectRate: number | null;
}

export interface SiteRanking {
  siteId: string;
  siteName: string;
  entries: SiteRankingEntry[];
  siteCompletionRate: number | null;
  siteNormRate: number | null;
  siteDone: number;
  siteAssigned: number;
  siteDefectCount: number;
  siteDefectRate: number | null;
}

const RISK_THRESHOLD = 0.15;
const UNDERPERFORMING_THRESHOLD = 0.7;
// Ниже этой доли нормы сотрудник считается отстающим (объективный сигнал).
const NORM_UNDERPERFORMING_THRESHOLD = 0.85;

@Injectable()
export class StatsService {
  constructor(private prisma: PrismaService) {}

  async computeSiteRanking(siteId: string, period: StatsPeriod = 'shift'): Promise<SiteRanking> {
    const site = await this.prisma.site.findUniqueOrThrow({ where: { id: siteId } });
    const start = periodStart(period);

    const assignments = await this.prisma.assignment.findMany({
      where: {
        operation: { OR: [{ siteId }, { secondarySiteId: siteId }] },
        completionRecords: { some: { recordedAt: { gte: start } } },
      },
      include: {
        user: { select: { id: true, fullName: true } },
        operation: { select: { quantity: true, skill: { select: { norm: true } } } },
        completionRecords: true,
      },
    });

    const byUser = new Map<
      string,
      {
        fullName: string;
        done: number;
        assigned: number;
        excusedCount: number;
        totalCount: number;
        defect: number;
        producedGood: number;
        normGood: number;
        normSum: number;
      }
    >();

    let siteDone = 0;
    let siteAssigned = 0;
    let siteDefect = 0;
    let siteProducedGood = 0;
    let siteNormGood = 0;
    let siteNormSum = 0;

    for (const a of assignments) {
      const record = a.completionRecords[0];
      if (!record) continue;

      const entry = byUser.get(a.userId) ?? {
        fullName: a.user.fullName,
        done: 0,
        assigned: 0,
        excusedCount: 0,
        totalCount: 0,
        defect: 0,
        producedGood: 0,
        normGood: 0,
        normSum: 0,
      };
      entry.totalCount += 1;

      // Defects/quality are tracked regardless of the rating exclusion, since
      // they reflect what was actually produced.
      entry.defect += record.defectQuantity ?? 0;
      entry.producedGood += record.doneQuantity ?? 0;
      siteDefect += record.defectQuantity ?? 0;
      siteProducedGood += record.doneQuantity ?? 0;

      if (record.reasonConfirmed) {
        entry.excusedCount += 1;
      } else {
        const assignedQty = a.assignedQuantity ?? a.operation.quantity;
        entry.done += record.doneQuantity ?? 0;
        entry.assigned += assignedQty;
        siteDone += record.doneQuantity ?? 0;
        siteAssigned += assignedQty;

        // Норма выработки: одна запись ≈ выработка за смену по операции.
        // Учитываем только операции, у которых задана положительная норма.
        const norm = a.operation.skill?.norm ?? null;
        if (norm && norm > 0) {
          const good = record.doneQuantity ?? 0;
          entry.normGood += good;
          entry.normSum += norm;
          siteNormGood += good;
          siteNormSum += norm;
        }
      }

      byUser.set(a.userId, entry);
    }

    const defectRate = (defect: number, good: number) => {
      const total = defect + good;
      return total > 0 ? defect / total : null;
    };

    const entries: SiteRankingEntry[] = Array.from(byUser.entries())
      .map(([userId, e]) => ({
        userId,
        fullName: e.fullName,
        completionRate: e.assigned > 0 ? e.done / e.assigned : null,
        normRate: e.normSum > 0 ? e.normGood / e.normSum : null,
        excusedCount: e.excusedCount,
        totalCount: e.totalCount,
        defectCount: e.defect,
        defectRate: defectRate(e.defect, e.producedGood),
      }))
      .sort((a, b) => (b.normRate ?? b.completionRate ?? -1) - (a.normRate ?? a.completionRate ?? -1));

    return {
      siteId: site.id,
      siteName: site.name,
      entries,
      siteCompletionRate: siteAssigned > 0 ? siteDone / siteAssigned : null,
      siteNormRate: siteNormSum > 0 ? siteNormGood / siteNormSum : null,
      siteDone,
      siteAssigned,
      siteDefectCount: siteDefect,
      siteDefectRate: defectRate(siteDefect, siteProducedGood),
    };
  }

  async toCsv(ranking: SiteRanking): Promise<string> {
    const header =
      'ФИО,Выполнение (%),Выполнение нормы (%),Брак (шт),Брак (%),Исключено (уважительная причина),Всего назначений';
    const rows = ranking.entries.map((e) =>
      [
        `"${e.fullName.replace(/"/g, '""')}"`,
        e.completionRate === null ? '' : Math.round(e.completionRate * 100),
        e.normRate === null ? '' : Math.round(e.normRate * 100),
        e.defectCount,
        e.defectRate === null ? '' : Math.round(e.defectRate * 100),
        e.excusedCount,
        e.totalCount,
      ].join(','),
    );
    return '﻿' + [header, ...rows].join('\n');
  }

  async plantSummary(period: StatsPeriod = 'shift') {
    const sites = await this.prisma.site.findMany({ orderBy: { name: 'asc' } });
    return Promise.all(
      sites.map(async (site) => {
        const ranking = await this.computeSiteRanking(site.id, period);
        return {
          siteId: site.id,
          siteName: site.name,
          completionRate: ranking.siteCompletionRate,
          normRate: ranking.siteNormRate,
          workersCount: ranking.entries.length,
        };
      }),
    );
  }

  private async computeOrderWarnings(siteId?: string) {
    const orders = await this.prisma.order.findMany({
      where: {
        status: { notIn: [OrderStatus.DONE, OrderStatus.SHIPPED] },
        ...(siteId ? { operations: { some: { OR: [{ siteId }, { secondarySiteId: siteId }] } } } : {}),
      },
      include: { operations: { include: { assignments: { include: { completionRecords: true } } } } },
    });

    const now = Date.now();
    return orders
      .map((order) => {
        const totalQty = order.operations.reduce((s, op) => s + op.quantity, 0);
        const doneQty = order.operations.reduce(
          (s, op) =>
            s +
            op.assignments.reduce((s2, a) => s2 + (a.completionRecords[0]?.doneQuantity ?? 0), 0),
          0,
        );
        const progressRatio = totalQty > 0 ? doneQty / totalQty : 0;
        const created = order.createdAt.getTime();
        const due = order.dueDate.getTime();
        const timeRatio = due > created ? Math.min(1, Math.max(0, (now - created) / (due - created))) : 1;
        return {
          orderId: order.id,
          orderName: order.name,
          dueDate: order.dueDate,
          progressRatio,
          timeRatio,
          atRisk: progressRatio + RISK_THRESHOLD < timeRatio,
        };
      })
      .filter((o) => o.atRisk);
  }

  async countAtRiskOrdersForSite(siteId: string): Promise<number> {
    const warnings = await this.computeOrderWarnings(siteId);
    return warnings.length;
  }

  async warnings() {
    const [orderWarnings, sites] = await Promise.all([
      this.computeOrderWarnings(),
      this.prisma.site.findMany(),
    ]);

    const rankings = await Promise.all(sites.map((site) => this.computeSiteRanking(site.id, 'week')));
    const workerWarnings = rankings.flatMap((ranking) =>
      ranking.entries
        .filter((e) =>
          // Объективный сигнал — выработка ниже нормы; при отсутствии норм
          // откатываемся к выполнению назначенного.
          e.normRate !== null
            ? e.normRate < NORM_UNDERPERFORMING_THRESHOLD
            : e.completionRate !== null && e.completionRate < UNDERPERFORMING_THRESHOLD,
        )
        .map((e) => ({
          userId: e.userId,
          fullName: e.fullName,
          siteName: ranking.siteName,
          completionRate: e.completionRate,
          normRate: e.normRate,
        })),
    );

    return { orderWarnings, workerWarnings };
  }

  /**
   * Plant-wide daily production trend over the last `days` calendar days
   * (based on when completion records were logged).
   */
  async trends(days = 14): Promise<TrendResult> {
    const span = Math.min(Math.max(Math.trunc(days) || 14, 1), 90);

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (span - 1));

    const records = await this.prisma.completionRecord.findMany({
      where: { recordedAt: { gte: start } },
      select: { doneQuantity: true, defectQuantity: true, recordedAt: true },
    });

    // Pre-seed every day in the window so gaps render as zero.
    const buckets = new Map<string, { producedGood: number; defects: number }>();
    for (let i = 0; i < span; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      buckets.set(dayKey(d), { producedGood: 0, defects: 0 });
    }

    for (const r of records) {
      const key = dayKey(r.recordedAt);
      const bucket = buckets.get(key);
      if (!bucket) continue;
      bucket.producedGood += r.doneQuantity ?? 0;
      bucket.defects += r.defectQuantity;
    }

    const points: TrendPoint[] = [...buckets.entries()].map(([date, b]) => {
      const total = b.producedGood + b.defects;
      return {
        date,
        producedGood: b.producedGood,
        defects: b.defects,
        defectRate: total > 0 ? b.defects / total : null,
      };
    });

    const totalGood = points.reduce((s, p) => s + p.producedGood, 0);
    const totalDefects = points.reduce((s, p) => s + p.defects, 0);
    const grandTotal = totalGood + totalDefects;

    return {
      days: span,
      points,
      totalProducedGood: totalGood,
      totalDefects,
      overallDefectRate: grandTotal > 0 ? totalDefects / grandTotal : null,
    };
  }
}

export interface TrendPoint {
  date: string; // YYYY-MM-DD
  producedGood: number;
  defects: number;
  defectRate: number | null;
}

export interface TrendResult {
  days: number;
  points: TrendPoint[];
  totalProducedGood: number;
  totalDefects: number;
  overallDefectRate: number | null;
}

/** Local calendar-day key (YYYY-MM-DD) matching how records are bucketed. */
function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
