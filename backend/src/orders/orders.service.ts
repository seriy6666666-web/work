import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { OrderStatus, Role } from '../generated/prisma/enums';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { CreateOrderFromProductDto } from './dto/create-order-from-product.dto';

function withOperationsSummary<T extends { operations: { quantity: number }[] }>(order: T) {
  const { operations, ...rest } = order;
  return {
    ...rest,
    operationsCount: operations.length,
    operationsQuantity: operations.reduce((sum, op) => sum + op.quantity, 0),
  };
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
      include: { operations: { select: { quantity: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return orders.map(withOperationsSummary);
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
          },
          orderBy: { operationType: { name: 'asc' } },
        },
      },
    });
    if (!order) {
      throw new NotFoundException('Заказ не найден');
    }
    return order;
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
            quantity: dto.quantity,
            operationTypeId: op.operationTypeId,
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

  async remove(id: string) {
    try {
      await this.prisma.order.delete({ where: { id } });
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new NotFoundException('Заказ не найден');
      }
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2003') {
        throw new ConflictException('У заказа есть операции — сначала удалите их');
      }
      throw err;
    }
  }
}
