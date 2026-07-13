import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderStatus } from '../generated/prisma/enums';
import { periodStart, type StatsPeriod } from './dto/stats-period.dto';

export interface SiteRankingEntry {
  userId: string;
  fullName: string;
  completionRate: number | null;
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
  siteDone: number;
  siteAssigned: number;
  siteDefectCount: number;
  siteDefectRate: number | null;
}

const RISK_THRESHOLD = 0.15;
const UNDERPERFORMING_THRESHOLD = 0.7;

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
        operation: { select: { quantity: true } },
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
      }
    >();

    let siteDone = 0;
    let siteAssigned = 0;
    let siteDefect = 0;
    let siteProducedGood = 0;

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
        excusedCount: e.excusedCount,
        totalCount: e.totalCount,
        defectCount: e.defect,
        defectRate: defectRate(e.defect, e.producedGood),
      }))
      .sort((a, b) => (b.completionRate ?? -1) - (a.completionRate ?? -1));

    return {
      siteId: site.id,
      siteName: site.name,
      entries,
      siteCompletionRate: siteAssigned > 0 ? siteDone / siteAssigned : null,
      siteDone,
      siteAssigned,
      siteDefectCount: siteDefect,
      siteDefectRate: defectRate(siteDefect, siteProducedGood),
    };
  }

  async toCsv(ranking: SiteRanking): Promise<string> {
    const header =
      'ФИО,Выполнение (%),Брак (шт),Брак (%),Исключено (уважительная причина),Всего назначений';
    const rows = ranking.entries.map((e) =>
      [
        `"${e.fullName.replace(/"/g, '""')}"`,
        e.completionRate === null ? '' : Math.round(e.completionRate * 100),
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
        .filter((e) => e.completionRate !== null && e.completionRate < UNDERPERFORMING_THRESHOLD)
        .map((e) => ({
          userId: e.userId,
          fullName: e.fullName,
          siteName: ranking.siteName,
          completionRate: e.completionRate,
        })),
    );

    return { orderWarnings, workerWarnings };
  }
}
