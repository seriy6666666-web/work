import { StatsService } from './stats.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Unit tests for the two ТЗ-critical business rules, with Prisma mocked:
 *  1. Confirmed-downtime assignments are excluded from the rating math
 *     (both numerator and denominator) — ТЗ п. 3.6 «такие случаи исключаются».
 *  2. Order "at-risk" formula — ТЗ п. 3.13: progress + 0.15 < elapsed time.
 */
describe('StatsService', () => {
  function makeService(prisma: Partial<Record<string, unknown>>) {
    return new StatsService(prisma as unknown as PrismaService);
  }

  describe('computeSiteRanking — rating exclusion', () => {
    it('excludes confirmed-downtime assignments from numerator and denominator', async () => {
      const prisma = {
        site: { findUniqueOrThrow: async () => ({ id: 's1', name: 'Сборка' }) },
        assignment: {
          findMany: async () => [
            {
              userId: 'u1',
              assignedQuantity: 10,
              user: { id: 'u1', fullName: 'Иван' },
              operation: { quantity: 10 },
              completionRecords: [{ doneQuantity: 10, reasonConfirmed: false, recordedAt: new Date() }],
            },
            {
              userId: 'u2',
              assignedQuantity: 10,
              user: { id: 'u2', fullName: 'Пётр' },
              operation: { quantity: 10 },
              completionRecords: [{ doneQuantity: 0, reasonConfirmed: true, recordedAt: new Date() }],
            },
          ],
        },
      };

      const ranking = await makeService(prisma).computeSiteRanking('s1', 'week');

      const ivan = ranking.entries.find((e) => e.userId === 'u1')!;
      const petr = ranking.entries.find((e) => e.userId === 'u2')!;

      expect(ivan.completionRate).toBe(1);
      expect(ivan.excusedCount).toBe(0);

      // Confirmed downtime -> excluded from ratio, counted only as excused.
      expect(petr.completionRate).toBeNull();
      expect(petr.excusedCount).toBe(1);
      expect(petr.totalCount).toBe(1);

      // Site rate must ignore the excused assignment entirely (10/10, not 10/20).
      expect(ranking.siteCompletionRate).toBe(1);
      expect(ranking.siteAssigned).toBe(10);
    });

    it('computes a partial completion rate for unconfirmed shortfalls', async () => {
      const prisma = {
        site: { findUniqueOrThrow: async () => ({ id: 's1', name: 'Сборка' }) },
        assignment: {
          findMany: async () => [
            {
              userId: 'u1',
              assignedQuantity: 10,
              user: { id: 'u1', fullName: 'Иван' },
              operation: { quantity: 10 },
              completionRecords: [{ doneQuantity: 7, reasonConfirmed: false, recordedAt: new Date() }],
            },
          ],
        },
      };

      const ranking = await makeService(prisma).computeSiteRanking('s1', 'week');
      expect(ranking.entries[0].completionRate).toBeCloseTo(0.7);
    });

    it('computes defect rate from defective units produced', async () => {
      const prisma = {
        site: { findUniqueOrThrow: async () => ({ id: 's1', name: 'Сборка' }) },
        assignment: {
          findMany: async () => [
            {
              userId: 'u1',
              assignedQuantity: 10,
              user: { id: 'u1', fullName: 'Иван' },
              operation: { quantity: 10 },
              completionRecords: [
                { doneQuantity: 7, defectQuantity: 3, reasonConfirmed: false, recordedAt: new Date() },
              ],
            },
          ],
        },
      };

      const ranking = await makeService(prisma).computeSiteRanking('s1', 'week');
      // 3 defective out of 10 produced = 30%
      expect(ranking.entries[0].defectCount).toBe(3);
      expect(ranking.entries[0].defectRate).toBeCloseTo(0.3);
      expect(ranking.siteDefectRate).toBeCloseTo(0.3);
    });
  });

  describe('computeSiteRanking — norm rate', () => {
    it('rates output against the per-shift norm and compares across operations', async () => {
      const prisma = {
        site: { findUniqueOrThrow: async () => ({ id: 's1', name: 'Сборка' }) },
        assignment: {
          findMany: async () => [
            {
              // 38 good on a norm-40 assembly op -> 95% of norm
              userId: 'u1',
              assignedQuantity: 40,
              user: { id: 'u1', fullName: 'Иванов' },
              operation: { quantity: 40, skill: { norm: 40 } },
              completionRecords: [{ doneQuantity: 38, defectQuantity: 0, reasonConfirmed: false, recordedAt: new Date() }],
            },
            {
              // 210 good on a norm-200 packing op -> 105% of norm (different operation, still comparable)
              userId: 'u2',
              assignedQuantity: 200,
              user: { id: 'u2', fullName: 'Сидоров' },
              operation: { quantity: 200, skill: { norm: 200 } },
              completionRecords: [{ doneQuantity: 210, defectQuantity: 0, reasonConfirmed: false, recordedAt: new Date() }],
            },
          ],
        },
      };

      const ranking = await makeService(prisma).computeSiteRanking('s1', 'week');
      const ivan = ranking.entries.find((e) => e.userId === 'u1')!;
      const sidor = ranking.entries.find((e) => e.userId === 'u2')!;

      expect(ivan.normRate).toBeCloseTo(0.95);
      expect(sidor.normRate).toBeCloseTo(1.05);
      // site: (38 + 210) / (40 + 200)
      expect(ranking.siteNormRate).toBeCloseTo(248 / 240);
    });

    it('leaves norm rate null when the operation has no norm', async () => {
      const prisma = {
        site: { findUniqueOrThrow: async () => ({ id: 's1', name: 'Сборка' }) },
        assignment: {
          findMany: async () => [
            {
              userId: 'u1',
              assignedQuantity: 10,
              user: { id: 'u1', fullName: 'Иван' },
              operation: { quantity: 10, skill: { norm: null } },
              completionRecords: [{ doneQuantity: 10, reasonConfirmed: false, recordedAt: new Date() }],
            },
          ],
        },
      };

      const ranking = await makeService(prisma).computeSiteRanking('s1', 'week');
      expect(ranking.entries[0].normRate).toBeNull();
      expect(ranking.siteNormRate).toBeNull();
      // completion rate still works without a norm
      expect(ranking.entries[0].completionRate).toBe(1);
    });

    it('excludes confirmed downtime from the norm rate', async () => {
      const prisma = {
        site: { findUniqueOrThrow: async () => ({ id: 's1', name: 'Сборка' }) },
        assignment: {
          findMany: async () => [
            {
              userId: 'u1',
              assignedQuantity: 40,
              user: { id: 'u1', fullName: 'Иван' },
              operation: { quantity: 40, skill: { norm: 40 } },
              completionRecords: [{ doneQuantity: 0, defectQuantity: 0, reasonConfirmed: true, recordedAt: new Date() }],
            },
          ],
        },
      };

      const ranking = await makeService(prisma).computeSiteRanking('s1', 'week');
      // Excused -> not counted against the norm.
      expect(ranking.entries[0].normRate).toBeNull();
      expect(ranking.siteNormRate).toBeNull();
      expect(ranking.entries[0].excusedCount).toBe(1);
    });
  });

  describe('toCsv — export format', () => {
    it('prefixes a UTF-8 BOM, writes the header and escapes quotes', async () => {
      const csv = await makeService({}).toCsv({
        siteId: 's1',
        siteName: 'Сборка',
        siteCompletionRate: 1,
        siteNormRate: 0.95,
        siteDone: 10,
        siteAssigned: 10,
        siteDefectCount: 2,
        siteDefectRate: 0.1,
        entries: [
          { userId: 'u1', fullName: 'Иван "Мастер"', completionRate: 0.85, normRate: 0.9, excusedCount: 1, totalCount: 3, defectCount: 2, defectRate: 0.1 },
          { userId: 'u2', fullName: 'Пётр', completionRate: null, normRate: null, excusedCount: 2, totalCount: 2, defectCount: 0, defectRate: null },
        ],
      });

      expect(csv.charCodeAt(0)).toBe(0xfeff); // BOM
      const lines = csv.slice(1).split('\n');
      expect(lines[0]).toContain('ФИО');
      expect(lines[1]).toBe('"Иван ""Мастер""",85,90,2,10,1,3'); // quotes doubled, rates rounded
      expect(lines[2]).toBe('"Пётр",,,0,,2,2'); // null rates -> empty cells
    });
  });

  describe('countAtRiskOrdersForSite — at-risk formula', () => {
    it('flags an overdue, under-progress order and ignores a fresh one', async () => {
      const now = Date.now();
      const day = 24 * 60 * 60 * 1000;

      const prisma = {
        order: {
          findMany: async () => [
            {
              // created 10 days ago, due yesterday -> timeRatio ≈ 1; progress 0.5 -> at risk
              id: 'o1',
              name: 'Горящий',
              createdAt: new Date(now - 10 * day),
              dueDate: new Date(now - 1 * day),
              operations: [
                {
                  quantity: 100,
                  assignments: [{ completionRecords: [{ doneQuantity: 50 }] }],
                },
              ],
            },
            {
              // just created, due in 10 days -> timeRatio ≈ 0 -> not at risk
              id: 'o2',
              name: 'Свежий',
              createdAt: new Date(now),
              dueDate: new Date(now + 10 * day),
              operations: [
                {
                  quantity: 100,
                  assignments: [{ completionRecords: [{ doneQuantity: 0 }] }],
                },
              ],
            },
          ],
        },
      };

      const count = await makeService(prisma).countAtRiskOrdersForSite('s1');
      expect(count).toBe(1);
    });
  });
});
