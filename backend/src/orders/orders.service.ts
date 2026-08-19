import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OrderStatus, Role } from '../generated/prisma/enums';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { CreateOrderFromProductDto } from './dto/create-order-from-product.dto';
import { deadlineState, isAlarming } from '../common/deadline';

function withOperationsSummary<
  T extends {
    quantity: number;
    operations: {
      quantity: number;
      perUnit: number;
      assignments?: { completionRecords: { doneQuantity: number | null }[] }[];
    }[];
  },
>(order: T) {
  const { operations, ...rest } = order;

  const doneByOperation = operations.map((op) =>
    (op.assignments ?? []).reduce(
      (sum, a) => sum + (a.completionRecords[0]?.doneQuantity ?? 0),
      0,
    ),
  );

  /**
   * Готовых изделий — по самому узкому шагу цепочки.
   *
   * Изделие готово, когда пройдены все операции, поэтому берём минимум. И делим
   * на коэффициент: резка провода даёт два провода на батарею, 200 нарезанных
   * проводов — это 100 батарей, а не 200.
   *
   * Планировщик раньше не видел ни того ни другого: данные были, до его экранов
   * их не доводили.
   */
  const readyUnits = operations.length
    ? Math.min(...operations.map((op, i) => Math.floor(doneByOperation[i] / Math.max(1, op.perUnit))))
    : 0;

  return {
    ...rest,
    operationsCount: operations.length,
    operationsQuantity: operations.reduce((sum, op) => sum + op.quantity, 0),
    operationsDone: doneByOperation.reduce((sum, d) => sum + d, 0),
    readyUnits: Math.max(0, Math.min(readyUnits, order.quantity)),
  };
}


/**
 * Как идёт заказ: сколько операций закрыто, сколько в работе, сколько без
 * исполнителя, и горит ли что-нибудь.
 *
 * Раньше это считалось по проекту, но проект — шаблон: количества и срока у него
 * нет, работа идёт по заказу.
 */
function orderProgress(
  order: {
    dueDate: Date;
    operations: {
      quantity: number;
      dailyQuantity: number | null;
      dueDate: Date | null;
      assignments: { completionRecords: { doneQuantity: number | null }[] }[];
    }[];
  },
  today: Date,
) {
  let done = 0;
  let inWork = 0;
  let unassigned = 0;
  let atRisk = false;

  for (const op of order.operations) {
    const made = op.assignments.reduce(
      (sum, a) => sum + (a.completionRecords[0]?.doneQuantity ?? 0),
      0,
    );
    if (op.quantity > 0 && made >= op.quantity) done += 1;
    else if (op.assignments.length > 0 || made > 0) inWork += 1;
    else unassigned += 1;

    if (
      isAlarming(
        deadlineState({
          dueDate: op.dueDate,
          orderDueDate: order.dueDate,
          quantity: op.quantity,
          done: made,
          dailyQuantity: op.dailyQuantity,
          today,
        }).level,
      )
    ) {
      atRisk = true;
    }
  }

  return { operationsDone: done, operationsInWork: inWork, operationsUnassigned: unassigned, atRisk };
}

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  /**
   * Recalculate an order's status from its operations' progress and move it
   * automatically: CREATED → IN_PROGRESS once anything is assigned, and
   * → DONE once every operation is fully completed. Shipped orders are left
   * untouched. Notifies planners when an order becomes DONE.
   */
  async recomputeStatus(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        operations: {
          include: { assignments: { include: { completionRecords: true } } },
        },
      },
    });
    if (!order || order.status === OrderStatus.SHIPPED) return;

    const hasOperations = order.operations.length > 0;
    const hasAnyAssignment = order.operations.some((op) => op.assignments.length > 0);
    const allComplete =
      hasOperations &&
      order.operations.every((op) => {
        const done = op.assignments.reduce(
          (sum, a) => sum + (a.completionRecords[0]?.doneQuantity ?? 0),
          0,
        );
        return done >= op.quantity;
      });

    let next = order.status;
    if (allComplete) next = OrderStatus.DONE;
    else if (hasAnyAssignment) next = OrderStatus.IN_PROGRESS;

    if (next === order.status) return;

    await this.prisma.order.update({ where: { id: orderId }, data: { status: next } });

    if (next === OrderStatus.DONE) {
      const planners = await this.prisma.user.findMany({ where: { role: Role.PLANNER, archivedAt: null } });
      await this.notifications.createMany(
        planners.map((p) => p.id),
        {
          type: 'ORDER_DONE',
          message: `Заказ «${order.name}» выполнен на 100%`,
          link: `/planner/orders/${order.id}`,
        },
      );
    }
  }

  async list() {
    const orders = await this.prisma.order.findMany({
      include: {
        operations: {
          select: {
            quantity: true,
            perUnit: true,
            dailyQuantity: true,
            dueDate: true,
            assignments: { select: { completionRecords: { select: { doneQuantity: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const today = new Date();
    return orders.map((order) => ({
      ...withOperationsSummary(order),
      progress: orderProgress(order, today),
    }));
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        operations: {
          include: {
            site: { select: { id: true, name: true } },
            operationType: {
              select: { id: true, name: true, norm: true, skill: { select: { id: true, name: true } } },
            },
            assignments: { select: { completionRecords: { select: { doneQuantity: true } } } },
          },
          orderBy: { operationType: { name: 'asc' } },
        },
      },
    });
    if (!order) {
      throw new NotFoundException('Заказ не найден');
    }

    /**
     * Сколько сделано по каждой операции. Планировщик раньше не видел этого
     * вовсе: цифры были на доске у начальника участка, но до карточки заказа их
     * не доводили, и планировать следующую партию приходилось вслепую.
     */
    const operations = order.operations.map(({ assignments, ...op }) => ({
      ...op,
      doneQuantity: assignments.reduce(
        (sum, a) => sum + (a.completionRecords[0]?.doneQuantity ?? 0),
        0,
      ),
    }));

    const readyUnits = operations.length
      ? Math.min(...operations.map((op) => Math.floor(op.doneQuantity / Math.max(1, op.perUnit))))
      : 0;

    return { ...order, operations, readyUnits: Math.max(0, Math.min(readyUnits, order.quantity)) };
  }

  create(dto: CreateOrderDto) {
    return this.prisma.order.create({
      data: {
        name: dto.name,
        quantity: dto.quantity,
        dueDate: new Date(dto.dueDate),
        priority: dto.priority ?? 0,
      },
    });
  }

  /**
   * Create an order from a product routing template: the order gets one
   * operation per template step, each sized to the order quantity.
   */
  async createFromProduct(dto: CreateOrderFromProductDto) {
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      include: {
        operations: { orderBy: { sequence: 'asc' }, include: { materials: true } },
      },
    });
    if (!product) throw new NotFoundException('Проект не найден');

    const platform = await this.prisma.platform.findUnique({ where: { id: dto.platformId } });
    if (!platform) throw new NotFoundException('Площадка не найдена');

    // Заказ привязан к проекту и площадке; расход материалов из техкарты
    // копируется на операции заказа (снимок на момент создания).
    return this.prisma.order.create({
      data: {
        name: dto.name?.trim() || product.name,
        quantity: dto.quantity,
        dueDate: new Date(dto.dueDate),
        priority: dto.priority ?? 0,
        projectId: product.id,
        platformId: platform.id,
        operations: {
          create: product.operations.map((op) => ({
            quantity: dto.quantity * op.perUnit,
            operationTypeId: op.operationTypeId,
            // Объём операции — в её собственных штуках: резка провода даёт два
            // провода на батарею, поэтому 100 батарей это 200 резов.
            perUnit: op.perUnit,
            siteId: op.siteId,
            secondarySiteId: op.secondarySiteId,
            // По умолчанию операцию делают там же, где оформлен заказ. Если фактически
            // её выполнят на другом адресе, планировщик меняет адрес у операции — с
            // него и спишутся материалы.
            platformId: platform.id,
            materialReqs: {
              create: op.materials.map((m) => ({
                materialId: m.materialId,
                quantityPerUnit: m.quantityPerUnit,
              })),
            },
          })),
        },
      },
      include: { operations: { select: { id: true } } },
    });
  }

  async update(id: string, dto: UpdateOrderDto) {
    try {
      return await this.prisma.order.update({
        where: { id },
        data: {
          name: dto.name,
          quantity: dto.quantity,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          priority: dto.priority,
          status: dto.status,
        },
      });
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new NotFoundException('Заказ не найден');
      }
      throw err;
    }
  }

  /**
   * Удалить заказ.
   *
   * Раньше требовалось сначала вручную убрать все операции — планировщик получал
   * отказ «сначала удалите их» и щёлкал по одной. Теперь операции уходят вместе с
   * заказом.
   *
   * Но только если по ним никто не отчитывался: выработка и брак — это история
   * производства, и удалять её задним числом нельзя, иначе статистика за период
   * молча изменится. Такой заказ отправляется в архив: пропадает из работы,
   * остаётся в отчётах.
   */
  async remove(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        operations: {
          include: { assignments: { include: { completionRecords: true } } },
        },
      },
    });
    if (!order) {
      throw new NotFoundException('Заказ не найден');
    }

    const records = order.operations.flatMap((op) =>
      op.assignments.flatMap((a) => a.completionRecords),
    );
    if (records.length > 0) {
      const done = records.reduce((sum, r) => sum + (r.doneQuantity ?? 0), 0);
      throw new ConflictException(
        `По заказу «${order.name}» уже отчитались (${records.length} отметок, ${done} шт годных) — ` +
          'удалить его нельзя, иначе выработка людей пропадёт из отчётов. ' +
          'Отправьте заказ в архив: из работы он исчезнет, в статистике останется.',
      );
    }

    const operationIds = order.operations.map((op) => op.id);
    await this.prisma.$transaction([
      this.prisma.assignment.deleteMany({ where: { operationId: { in: operationIds } } }),
      this.prisma.operationMaterialReq.deleteMany({ where: { operationId: { in: operationIds } } }),
      this.prisma.operation.deleteMany({ where: { orderId: id } }),
      this.prisma.order.delete({ where: { id } }),
    ]);
  }

  /** Убрать заказ из работы, сохранив историю. Возврат — сменой статуса обратно. */
  async archive(id: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) {
      throw new NotFoundException('Заказ не найден');
    }
    return this.prisma.order.update({ where: { id }, data: { status: OrderStatus.ARCHIVED } });
  }
}
