import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { SubmitCompletionDto } from './dto/submit-completion.dto';

const MAX_CORRECTIONS = 2;

const includeTaskDetails = {
  operation: {
    include: {
      skill: { select: { id: true, name: true } },
      order: { select: { id: true, name: true, priority: true, dueDate: true } },
    },
  },
  completionRecords: true,
} as const;

function toTask<T extends { completionRecords: { correctionCount: number }[] }>(assignment: T) {
  const { completionRecords, ...rest } = assignment;
  const completionRecord = completionRecords[0] ?? null;
  return {
    ...rest,
    completionRecord,
    canCorrect: !completionRecord || completionRecord.correctionCount < MAX_CORRECTIONS,
  };
}

@Injectable()
export class MyTasksService {
  constructor(
    private prisma: PrismaService,
    private ordersService: OrdersService,
  ) {}

  async list(userId: string) {
    const assignments = await this.prisma.assignment.findMany({
      where: { userId },
      include: includeTaskDetails,
      orderBy: [
        { operation: { order: { priority: 'desc' } } },
        { operation: { order: { dueDate: 'asc' } } },
      ],
    });
    return assignments.map(toTask);
  }

  async submitCompletion(userId: string, assignmentId: string, dto: SubmitCompletionDto) {
    const assignment = await this.prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: includeTaskDetails,
    });
    if (!assignment) {
      throw new NotFoundException('Назначение не найдено');
    }
    if (assignment.userId !== userId) {
      throw new ForbiddenException('Это назначение не относится к вам');
    }

    const existing = assignment.completionRecords[0];
    if (!existing) {
      await this.prisma.completionRecord.create({
        data: {
          assignmentId,
          doneQuantity: dto.doneQuantity,
          reasonCode: dto.reasonCode,
          reasonComment: dto.reasonComment,
          correctionCount: 0,
        },
      });
    } else {
      if (existing.correctionCount >= MAX_CORRECTIONS) {
        throw new ForbiddenException('Лимит исправлений исчерпан — обратитесь к начальнику участка');
      }
      await this.prisma.completionRecord.update({
        where: { id: existing.id },
        data: {
          doneQuantity: dto.doneQuantity,
          reasonCode: dto.reasonCode,
          reasonComment: dto.reasonComment,
          reasonConfirmed: false,
          correctionCount: existing.correctionCount + 1,
        },
      });
    }

    await this.ordersService.recomputeStatus(assignment.operation.order.id);

    const updated = await this.prisma.assignment.findUniqueOrThrow({
      where: { id: assignmentId },
      include: includeTaskDetails,
    });
    return toTask(updated);
  }
}
