import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransfersService } from '../transfers/transfers.service';
import { AbsencesService } from '../absences/absences.service';
import { StatsService } from '../stats/stats.service';
import { AttendanceService } from '../attendance/attendance.service';
import { OrdersService } from '../orders/orders.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { ConfirmReasonDto } from './dto/confirm-reason.dto';

const includeAssignmentUser = { user: { select: { id: true, fullName: true } } } as const;

function belongsToSite(operation: { siteId: string; secondarySiteId: string | null }, siteId: string) {
  return operation.siteId === siteId || operation.secondarySiteId === siteId;
}

@Injectable()
export class DistributionService {
  constructor(
    private prisma: PrismaService,
    private transfersService: TransfersService,
    private absencesService: AbsencesService,
    private statsService: StatsService,
    private attendanceService: AttendanceService,
    private ordersService: OrdersService,
    private notifications: NotificationsService,
  ) {}

  async listOperations(siteId: string, viewerId: string) {
    const [operations, competencies] = await Promise.all([
      this.prisma.operation.findMany({
        where: { OR: [{ siteId }, { secondarySiteId: siteId }] },
        include: {
          order: { select: { id: true, name: true, priority: true, dueDate: true } },
          skill: { select: { id: true, name: true } },
          secondarySite: { select: { id: true, name: true } },
          assignments: {
            include: {
              user: { select: { id: true, fullName: true } },
              completionRecords: true,
            },
          },
        },
        orderBy: [{ order: { priority: 'desc' } }, { order: { dueDate: 'asc' } }],
      }),
      this.prisma.competency.findMany({
        where: { userId: { in: await this.transfersService.getEffectiveSiteUserIds(siteId, viewerId) } },
        select: { skillId: true },
      }),
    ]);

    const competentSkillIds = new Set(competencies.map((c) => c.skillId));

    return operations.map((op) => {
      const totalDoneQuantity = op.assignments.reduce((sum, a) => {
        const done = a.completionRecords[0]?.doneQuantity ?? 0;
        return sum + done;
      }, 0);
      return {
        ...op,
        hasCompetentWorker: competentSkillIds.has(op.skillId),
        totalDoneQuantity,
      };
    });
  }

  async getSummary(siteId: string, viewerId: string) {
    const [ranking, operations, atRiskCount, effectiveUserIds, incomingTransfers] = await Promise.all([
      this.statsService.computeSiteRanking(siteId, 'shift'),
      this.listOperations(siteId, viewerId),
      this.statsService.countAtRiskOrdersForSite(siteId),
      this.transfersService.getEffectiveSiteUserIds(siteId, viewerId),
      this.transfersService.getActiveIncomingTransfers(siteId),
    ]);

    const users = await this.prisma.user.findMany({
      where: { id: { in: effectiveUserIds } },
      select: { id: true, fullName: true },
    });

    const rateByUser = new Map(ranking.entries.map((e) => [e.userId, e.completionRate]));
    const invitedUserIds = new Set(incomingTransfers.map((t) => t.userId));
    const checkedInSet = await this.attendanceService.listCheckedInToday(effectiveUserIds);
    const absentFlags = await Promise.all(users.map((u) => this.absencesService.isAbsentToday(u.id)));

    const roster = users.map((u, i) => ({
      userId: u.id,
      fullName: u.fullName,
      checkedIn: checkedInSet.has(u.id),
      invited: invitedUserIds.has(u.id),
      absent: absentFlags[i],
      loadPercent: rateByUser.get(u.id) ?? null,
    }));

    return {
      siteId: ranking.siteId,
      siteName: ranking.siteName,
      completionRate: ranking.siteCompletionRate,
      planDone: ranking.siteDone,
      planTotal: ranking.siteAssigned,
      operationsInWork: operations.filter((op) => op.assignments.length > 0).length,
      operationsTotal: operations.length,
      atRiskCount,
      roster,
    };
  }

  async createAssignment(siteId: string, viewerId: string, dto: CreateAssignmentDto) {
    const operation = await this.prisma.operation.findUnique({ where: { id: dto.operationId } });
    if (!operation) {
      throw new NotFoundException('Операция не найдена');
    }
    if (!belongsToSite(operation, siteId)) {
      throw new ForbiddenException('Операция относится к другому участку');
    }

    const eligibleUserIds = await this.transfersService.getEffectiveSiteUserIds(siteId, viewerId);
    if (!eligibleUserIds.includes(dto.userId)) {
      /**
       * Различаем два случая. Раньше на оба отвечали «не относится к вашему участку»,
       * и начальник участка с адресом видел это про своего же человека с другого
       * адреса — по его мнению, ровно про своего.
       */
      const [candidate, viewerPlatformId] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: dto.userId },
          select: { fullName: true, siteId: true, platform: { select: { name: true } } },
        }),
        this.transfersService.platformOf(viewerId),
      ]);
      if (candidate && candidate.siteId === siteId && viewerPlatformId) {
        throw new BadRequestException(
          `«${candidate.fullName}» работает на другом адресе (${candidate.platform?.name ?? 'адрес не указан'}) — ` +
            'назначать его нельзя. Если человек перешёл, смените адрес у него в разделе «Пользователи», ' +
            'или запросите его как перевод.',
        );
      }
      throw new BadRequestException('Сотрудник не относится к вашему участку');
    }
    if (await this.absencesService.isAbsentToday(dto.userId)) {
      throw new BadRequestException('Сотрудник отсутствует');
    }

    /**
     * Один человек на операции — одна запись. В базе это ограничение тоже стоит, но
     * без явной проверки начальник участка получил бы отказ вида «нарушено ограничение
     * уникальности». Раньше проверки не было вовсе: сотрудника можно было назначить
     * дважды, доска показывала его дважды, а объёмы складывались.
     */
    const already = await this.prisma.assignment.findUnique({
      where: { operationId_userId: { operationId: dto.operationId, userId: dto.userId } },
      include: { user: { select: { fullName: true } } },
    });
    if (already) {
      throw new BadRequestException(
        `«${already.user.fullName}» уже назначен на эту операцию (${already.assignedQuantity ?? 'весь объём'}). ` +
          'Чтобы изменить объём, поправьте существующее назначение, а не добавляйте второе.',
      );
    }

    const assignment = await this.prisma.assignment.create({
      data: {
        operationId: dto.operationId,
        userId: dto.userId,
        assignedQuantity: dto.assignedQuantity,
      },
      include: includeAssignmentUser,
    });

    await this.notifications.create({
      userId: dto.userId,
      type: 'ASSIGNMENT',
      message: 'Вам назначена новая операция',
      link: '/worker/tasks',
    });
    await this.ordersService.recomputeStatus(operation.orderId);

    return assignment;
  }

  async updateAssignment(siteId: string, id: string, dto: UpdateAssignmentDto) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id },
      include: { operation: { select: { siteId: true, secondarySiteId: true } } },
    });
    if (!assignment) {
      throw new NotFoundException('Назначение не найдено');
    }
    if (!belongsToSite(assignment.operation, siteId)) {
      throw new ForbiddenException('Назначение относится к другому участку');
    }

    return this.prisma.assignment.update({
      where: { id },
      data: { assignedQuantity: dto.assignedQuantity },
      include: includeAssignmentUser,
    });
  }

  async removeAssignment(siteId: string, id: string) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id },
      include: {
        operation: { select: { siteId: true, secondarySiteId: true, orderId: true } },
        completionRecords: { select: { doneQuantity: true, defectQuantity: true } },
      },
    });
    if (!assignment) {
      throw new NotFoundException('Назначение не найдено');
    }
    if (!belongsToSite(assignment.operation, siteId)) {
      throw new ForbiddenException('Назначение относится к другому участку');
    }

    /**
     * Снять человека с операции, по которой он уже отчитался, значит потерять
     * выработку и брак — это история производства. Раньше здесь падал Prisma на
     * обязательной связи с отметкой, и начальник участка получал 500 без объяснений.
     */
    const record = assignment.completionRecords[0];
    if (record) {
      const done = record.doneQuantity ?? 0;
      throw new BadRequestException(
        `Сотрудник уже отчитался по этой операции (${done} годных, ${record.defectQuantity} брак) — ` +
          'снять его нельзя, иначе потеряется выработка. Исправьте количество или уменьшите назначенный объём.',
      );
    }

    await this.prisma.assignment.delete({ where: { id } });
    await this.ordersService.recomputeStatus(assignment.operation.orderId);
  }

  async confirmReason(siteId: string, completionRecordId: string, dto: ConfirmReasonDto) {
    const record = await this.prisma.completionRecord.findUnique({
      where: { id: completionRecordId },
      include: { assignment: { include: { operation: { select: { siteId: true, secondarySiteId: true } } } } },
    });
    if (!record) {
      throw new NotFoundException('Отметка выполнения не найдена');
    }
    if (!belongsToSite(record.assignment.operation, siteId)) {
      throw new ForbiddenException('Отметка относится к другому участку');
    }

    return this.prisma.completionRecord.update({
      where: { id: completionRecordId },
      data: {
        reasonConfirmed: true,
        reasonCode: dto.reasonCode ?? record.reasonCode,
      },
    });
  }
}
