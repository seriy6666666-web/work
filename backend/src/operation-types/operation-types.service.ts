import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOperationTypeDto } from './dto/create-operation-type.dto';
import { UpdateOperationTypeDto } from './dto/update-operation-type.dto';

const includeSkill = { skill: { select: { id: true, name: true } } } as const;

@Injectable()
export class OperationTypesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Архивные по умолчанию не отдаём: их не должно быть в выборе при сборке
   * техкарты. Но показать их надо уметь — иначе непонятно, что за операция стоит
   * в старом заказе.
   */
  async list(withArchived = false) {
    const items = await this.prisma.operationType.findMany({
      where: withArchived ? {} : { archivedAt: null },
      include: {
        ...includeSkill,
        _count: { select: { operations: true, productOperations: true } },
      },
      orderBy: { name: 'asc' },
    });

    return items.map(({ _count, ...rest }) => ({
      ...rest,
      usedInOrders: _count.operations,
      usedInProducts: _count.productOperations,
    }));
  }

  async create(dto: CreateOperationTypeDto) {
    try {
      return await this.prisma.operationType.create({
        data: { name: dto.name, norm: dto.norm ?? null, skillId: dto.skillId ?? null },
        include: includeSkill,
      });
    } catch (err) {
      throw this.translate(err);
    }
  }

  async update(id: string, dto: UpdateOperationTypeDto) {
    try {
      return await this.prisma.operationType.update({
        where: { id },
        data: {
          name: dto.name,
          // undefined — не трогаем, null — снимаем.
          norm: dto.norm === undefined ? undefined : dto.norm,
          skillId: dto.skillId === undefined ? undefined : dto.skillId,
        },
        include: includeSkill,
      });
    } catch (err) {
      throw this.translate(err);
    }
  }

  /**
   * Операцию, которая уже стоит в заказах или техкартах, не удаляем: за ней
   * выработка людей и состав изделия. Такую отправляем в архив — из выбора
   * пропадает, в истории остаётся. Так же сделано с уволенными сотрудниками.
   */
  async remove(id: string) {
    const operationType = await this.prisma.operationType.findUnique({
      where: { id },
      include: { _count: { select: { operations: true, productOperations: true } } },
    });
    if (!operationType) {
      throw new NotFoundException('Операция не найдена');
    }

    const { operations, productOperations } = operationType._count;
    if (operations > 0 || productOperations > 0) {
      const where: string[] = [];
      if (operations > 0) where.push(`заказах (${operations})`);
      if (productOperations > 0) where.push(`техкартах изделий (${productOperations})`);
      throw new ConflictException(
        `«${operationType.name}» используется в ${where.join(' и ')} — удалить нельзя, ` +
          'иначе потеряется выработка по ней. Отправьте операцию в архив: из выбора она ' +
          'пропадёт, а в отчётах останется.',
      );
    }

    await this.prisma.operationType.delete({ where: { id } });
  }

  archive(id: string) {
    return this.setArchived(id, new Date());
  }

  restore(id: string) {
    return this.setArchived(id, null);
  }

  private async setArchived(id: string, archivedAt: Date | null) {
    try {
      return await this.prisma.operationType.update({
        where: { id },
        data: { archivedAt },
        include: includeSkill,
      });
    } catch (err) {
      throw this.translate(err);
    }
  }

  private translate(err: unknown): unknown {
    if (err instanceof PrismaClientKnownRequestError) {
      if (err.code === 'P2002') {
        return new ConflictException(
          'Операция с таким названием уже есть. Справочник для того и нужен, ' +
            'чтобы одна и та же работа не появлялась в списке дважды.',
        );
      }
      if (err.code === 'P2025') {
        return new NotFoundException('Операция не найдена');
      }
      if (err.code === 'P2003') {
        return new ConflictException('Указанный навык не найден');
      }
    }
    return err;
  }
}
