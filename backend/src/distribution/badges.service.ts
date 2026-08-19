import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransfersService } from '../transfers/transfers.service';
import { AbsencesService } from '../absences/absences.service';
import { TaskStatus, TransferStatus } from '../generated/prisma/enums';
import { deadlineState, isAlarming } from '../common/deadline';

/**
 * Счётчики у пунктов меню начальника участка.
 *
 * Смысл только один: показать, где его ждёт работа, до того как он туда зайдёт.
 * Поэтому считаем поводы, а не события — значок гаснет сам, когда повод исчез, и
 * не требует «прочитать». Иначе он бы копился, все научились бы его не замечать,
 * и он перестал бы работать там, где действительно нужен.
 *
 * Числа, а не точки: «3 запроса на перевод» полезнее, чем «что-то есть». Точку
 * без числа оставляем только там, где количество ничего не добавляет.
 */
export interface SiteLeadBadges {
  /** Запросы на перевод его людей, ждущие ответа. */
  transfers: number;
  /** Операции на сегодня, на которые никого не поставили. */
  unassigned: number;
  /** Сколько человек участка отсутствует сегодня. */
  absences: number;
  /** Пришла ли передача дел от предыдущей смены (за последние сутки). */
  handover: boolean;
  /** Открытые задачи, поставленные лично ему. */
  tasks: number;
  /** Операции, которые уже не успеть или срок которых прошёл. */
  overdue: number;
}

function today(): Date {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

@Injectable()
export class BadgesService {
  constructor(
    private prisma: PrismaService,
    private transfers: TransfersService,
    private absences: AbsencesService,
  ) {}

  async forSiteLead(siteId: string, userId: string): Promise<SiteLeadBadges> {
    const day = today();

    const [transfers, operations, siteUserIds, handoverCount, tasks] = await Promise.all([
      // Запросы «отдайте вашего человека» — на них отвечает он.
      this.prisma.transfer.count({
        where: { fromSiteId: siteId, status: TransferStatus.PENDING },
      }),
      this.prisma.operation.findMany({
        where: {
          OR: [{ siteId }, { secondarySiteId: siteId }],
          order: { status: { notIn: ['ARCHIVED', 'DONE', 'SHIPPED'] } },
        },
        select: {
          id: true,
          quantity: true,
          dailyQuantity: true,
          dueDate: true,
          order: { select: { dueDate: true } },
          assignments: { where: { date: day }, select: { id: true } },
        },
      }),
      this.transfers.getEffectiveSiteUserIds(siteId, userId),
      this.prisma.shiftHandover.count({
        where: {
          siteId,
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          // Свои же записи поводом не считаем: он их и писал.
          NOT: { fromUserId: userId },
        },
      }),
      this.prisma.task.count({ where: { assigneeId: userId, status: TaskStatus.OPEN } }),
    ]);

    const absentFlags = await Promise.all(siteUserIds.map((id) => this.absences.isAbsentToday(id)));

    // Сделанное по каждой операции за всё время — одним запросом, иначе на участке
    // с сотней операций это была бы сотня запросов ради одного значка.
    const doneByOperation = new Map<string, number>();
    if (operations.length > 0) {
      const records = await this.prisma.completionRecord.findMany({
        where: { assignment: { operationId: { in: operations.map((o) => o.id) } } },
        select: { doneQuantity: true, assignment: { select: { operationId: true } } },
      });
      for (const r of records) {
        const id = r.assignment.operationId;
        doneByOperation.set(id, (doneByOperation.get(id) ?? 0) + (r.doneQuantity ?? 0));
      }
    }

    const overdue = operations.filter((op) =>
      isAlarming(
        deadlineState({
          dueDate: op.dueDate,
          orderDueDate: op.order.dueDate,
          quantity: op.quantity,
          done: doneByOperation.get(op.id) ?? 0,
          dailyQuantity: op.dailyQuantity,
          today: day,
        }).level,
      ),
    ).length;

    return {
      transfers,
      unassigned: operations.filter((op) => op.assignments.length === 0).length,
      absences: absentFlags.filter(Boolean).length,
      handover: handoverCount > 0,
      tasks,
      overdue,
    };
  }
}
