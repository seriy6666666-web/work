import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOperationDto } from './dto/create-operation.dto';
import { UpdateOperationDto } from './dto/update-operation.dto';

const includeSiteAndOperation = {
  site: { select: { id: true, name: true } },
  secondarySite: { select: { id: true, name: true } },
  operationType: {
    select: { id: true, name: true, norm: true, skill: { select: { id: true, name: true } } },
  },
} as const;

/**
 * Срок операции не может быть позже срока заказа.
 *
 * Заказ уходит заказчику в свою дату, и операция, назначенная на после неё,
 * означала бы «сдать после отгрузки». Опечатка в году или в месяце иначе
 * проходит молча, а вылезает уже на участке, когда сроки перестают сходиться.
 */
function checkAgainstOrder(dueDate: string | null | undefined, orderDueDate: Date) {
  if (!dueDate) return;
  const value = new Date(dueDate);
  if (value.getTime() > orderDueDate.getTime()) {
    throw new BadRequestException(
      `Срок операции (${value.toLocaleDateString('ru-RU')}) позже срока заказа ` +
        `(${orderDueDate.toLocaleDateString('ru-RU')}) — операцию нужно сдать до отгрузки, а не после.`,
    );
  }
}

@Injectable()
export class OperationsService {
  constructor(private prisma: PrismaService) {}

  async listByOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Заказ не найден');
    }
    return this.prisma.operation.findMany({
      where: { orderId },
      include: includeSiteAndOperation,
      orderBy: { operationType: { name: 'asc' } },
    });
  }

  async create(orderId: string, dto: CreateOperationDto) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Заказ не найден');
    }

    checkAgainstOrder(dto.dueDate, order.dueDate);

    try {
      return await this.prisma.operation.create({
        data: {
          quantity: dto.quantity,
          dailyQuantity: dto.dailyQuantity,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          perUnit: dto.perUnit,
          siteId: dto.siteId,
          secondarySiteId: dto.secondarySiteId,
          operationTypeId: dto.operationTypeId,
          orderId,
          // Адрес операции по умолчанию — адрес заказа: обычно где оформили, там и делают.
          // Материалы списываются именно с адреса операции, поэтому если работа уйдёт на
          // другую площадку, адрес нужно поменять здесь, а не у заказа.
          platformId: dto.platformId ?? order.platformId,
        },
        include: includeSiteAndOperation,
      });
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2003') {
        throw new BadRequestException('Указанный участок или операция не найдены');
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateOperationDto) {
    if (dto.dueDate !== undefined) {
      const existing = await this.prisma.operation.findUnique({
        where: { id },
        select: { order: { select: { dueDate: true } } },
      });
      if (!existing) {
        throw new NotFoundException('Операция не найдена');
      }
      checkAgainstOrder(dto.dueDate, existing.order.dueDate);
    }

    /**
     * Объём нельзя опустить ниже того, что уже сделано.
     *
     * Иначе в отчётах появляется «сделано 40 из 20»: процент выполнения
     * переваливает за сотню, а начальник производства видит участок,
     * перевыполнивший план, которого не было. Уменьшать объём по ходу работы
     * нормально — но не ниже фактически сданного.
     */
    if (dto.quantity !== undefined) {
      const done = await this.prisma.completionRecord.aggregate({
        where: { assignment: { operationId: id } },
        _sum: { doneQuantity: true, defectQuantity: true },
      });
      const made = (done._sum.doneQuantity ?? 0) + (done._sum.defectQuantity ?? 0);
      if (dto.quantity < made) {
        throw new BadRequestException(
          `По операции уже изготовлено ${made} шт (годных и брака) — ` +
            `объём меньше этого числа поставить нельзя, иначе выполнение уйдёт за 100 %.`,
        );
      }
    }

    try {
      return await this.prisma.operation.update({
        where: { id },
        data: {
          quantity: dto.quantity,
          dailyQuantity: dto.dailyQuantity,
          // undefined — поле не трогали, null — срок сняли.
          dueDate: dto.dueDate === undefined ? undefined : dto.dueDate ? new Date(dto.dueDate) : null,
          perUnit: dto.perUnit,
          siteId: dto.siteId,
          secondarySiteId: dto.secondarySiteId,
          operationTypeId: dto.operationTypeId,
          // Меняется, когда работу фактически делают на другом адресе: с адреса
          // операции списываются материалы.
          platformId: dto.platformId,
        },
        include: includeSiteAndOperation,
      });
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new NotFoundException('Операция не найдена');
      }
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2003') {
        throw new BadRequestException('Указанный участок или операция не найдены');
      }
      throw err;
    }
  }

  /**
   * Удалять операцию, по которой уже отчитались, нельзя: вместе с ней ушли бы
   * выработка и брак, а это история производства.
   *
   * Раньше проверки не было и Prisma падала на внешнем ключе назначений —
   * планировщик получал «Внутренняя ошибка сервера» без объяснения. Заказы,
   * участки и навыки в этом же приложении отвечают на такое понятным текстом
   * вида «У заказа есть операции — сначала удалите их»; операции отставали.
   *
   * Если назначения есть, но никто ещё не отчитывался, операцию удаляем вместе
   * с ними: это ещё не история, а просто нераспределённое обратно назначение.
   */
  async remove(id: string) {
    const operation = await this.prisma.operation.findUnique({
      where: { id },
      include: {
        operationType: { select: { name: true } },
        assignments: {
          include: {
            user: { select: { fullName: true } },
            completionRecords: { select: { doneQuantity: true, defectQuantity: true } },
          },
        },
      },
    });
    if (!operation) {
      throw new NotFoundException('Операция не найдена');
    }

    const reported = operation.assignments.filter((a) => a.completionRecords.length > 0);
    if (reported.length > 0) {
      const who = reported.map((a) => a.user.fullName).join(', ');
      const done = reported.reduce((sum, a) => sum + (a.completionRecords[0]?.doneQuantity ?? 0), 0);
      throw new ConflictException(
        `По операции «${operation.operationType.name}» уже отчитались (${who}; ${done} шт годных) — ` +
          'удалить её нельзя, иначе потеряется выработка. Уменьшите объём операции или ' +
          'снимите незанятых сотрудников.',
      );
    }

    await this.prisma.$transaction([
      this.prisma.assignment.deleteMany({ where: { operationId: id } }),
      this.prisma.operationMaterialReq.deleteMany({ where: { operationId: id } }),
      this.prisma.operation.delete({ where: { id } }),
    ]);
  }
}
