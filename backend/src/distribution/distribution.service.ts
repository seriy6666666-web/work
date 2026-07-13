import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransfersService } from '../transfers/transfers.service';
import { AbsencesService } from '../absences/absences.service';
import { StatsService } from '../stats/stats.service';
import { AttendanceService } from '../attendance/attendance.service';
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
  ) {}

  async listOperations(siteId: string) {
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
        where: { userId: { in: await this.transfersService.getEffectiveSiteUserIds(siteId) } },
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

  async getSummary(siteId: string) {
    const [ranking, operations, atRiskCount, effectiveUserIds, incomingTransfers] = await Promise.all([
      this.statsService.computeSiteRanking(siteId, 'shift'),
      this.listOperations(siteId),
      this.statsService.countAtRiskOrdersForSite(siteId),
      this.transfersService.getEffectiveSiteUserIds(siteId),
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

  async createAssignment(siteId: string, dto: CreateAssignmentDto) {
    const operation = await this.prisma.operation.findUnique({ where: { id: dto.operationId } });
    if (!operation) {
      throw new NotFoundException('Операция не найдена');
    }
    if (!belongsToSite(operation, siteId)) {
      throw new ForbiddenException('Операция относится к другому участку');
    }

    const eligibleUserIds = await this.transfersService.getEffectiveSiteUserIds(siteId);
    if (!eligibleUserIds.includes(dto.userId)) {
      throw new BadRequestException('Сотрудник не относится к вашему участку');
    }
    if (await this.absencesService.isAbsentToday(dto.userId)) {
      throw new BadRequestException('Сотрудник отсутствует');
    }

    return this.prisma.assignment.create({
      data: {
        operationId: dto.operationId,
        userId: dto.userId,
        assignedQuantity: dto.assignedQuantity,
      },
      include: includeAssignmentUser,
    });
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
      include: { operation: { select: { siteId: true, secondarySiteId: true } } },
    });
    if (!assignment) {
      throw new NotFoundException('Назначение не найдено');
    }
    if (!belongsToSite(assignment.operation, siteId)) {
      throw new ForbiddenException('Назначение относится к другому участку');
    }

    await this.prisma.assignment.delete({ where: { id } });
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
