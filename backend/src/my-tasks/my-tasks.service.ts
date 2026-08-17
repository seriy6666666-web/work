import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { MaterialsService } from '../materials/materials.service';
import { SubmitCompletionDto } from './dto/submit-completion.dto';

const MAX_CORRECTIONS = 2;

const includeTaskDetails = {
  operation: {
    include: {
      operationType: {
        select: { id: true, name: true, norm: true, skill: { select: { id: true, name: true } } },
      },
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
    private materials: MaterialsService,
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
    /**
     * Материал расходуется на всё изготовленное, включая брак: на испорченную
     * пластину свинец ушёл ровно так же, как на годную.
     *
     * Раньше списывали только по годным. Остаток в системе держался выше
     * фактического, расхождение копилось со скоростью процента брака, а сигнал о
     * низком остатке срабатывал позже, чем материал реально заканчивался.
     */
    const previousProduced = (existing?.doneQuantity ?? 0) + (existing?.defectQuantity ?? 0);
    if (!existing) {
      await this.prisma.completionRecord.create({
        data: {
          assignmentId,
          doneQuantity: dto.doneQuantity,
          defectQuantity: dto.defectQuantity ?? 0,
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
          defectQuantity: dto.defectQuantity ?? 0,
          reasonCode: dto.reasonCode,
          reasonComment: dto.reasonComment,
          reasonConfirmed: false,
          correctionCount: existing.correctionCount + 1,
        },
      });
    }

    /**
     * Автосписание по факту: списываем изменение изготовленного количества
     * (при исправлении — разницу, при уменьшении — возврат). Считаем по сумме
     * годных и брака, иначе правка одного только брака остаток бы не двигала.
     */
    const produced = (dto.doneQuantity ?? 0) + (dto.defectQuantity ?? 0);
    const delta = produced - previousProduced;
    if (delta !== 0) {
      await this.consumeMaterials(assignment.operationId, delta);
    }

    await this.ordersService.recomputeStatus(assignment.operation.order.id);

    const updated = await this.prisma.assignment.findUniqueOrThrow({
      where: { id: assignmentId },
      include: includeTaskDetails,
    });
    return toTask(updated);
  }

  /**
   * Списать материалы по техкарте операции с остатка нужной площадки/проекта.
   * `deltaQuantity` — изменение изготовленного количества (может быть < 0 = возврат).
   * Расход считается по всему изготовленному: годные плюс брак.
   */
  private async consumeMaterials(operationId: string, deltaQuantity: number) {
    const op = await this.prisma.operation.findUnique({
      where: { id: operationId },
      include: {
        order: { select: { projectId: true, platformId: true } },
        materialReqs: true,
      },
    });
    if (!op?.order.projectId || op.materialReqs.length === 0) return;

    /**
     * Списываем с адреса, где операцию делали, а не с адреса заказа. Раньше брали
     * адрес заказа: если заказ оформлен на ЮП26, а операцию выполнили на ЮП33,
     * материалы уходили со склада ЮП26 — списывался чужой остаток, и обе площадки
     * видели неправду.
     *
     * Адрес заказа остаётся запасным вариантом: у операций, созданных до появления
     * этого поля, и там, где адрес не указан, поведение не меняется.
     */
    const platformId = op.platformId ?? op.order.platformId;
    if (!platformId) return;

    for (const req of op.materialReqs) {
      await this.materials.consume(
        op.order.projectId,
        platformId,
        req.materialId,
        req.quantityPerUnit * deltaQuantity,
      );
    }
  }
}
