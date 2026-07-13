import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOperationDto } from './dto/create-operation.dto';
import { UpdateOperationDto } from './dto/update-operation.dto';

const includeSiteAndSkill = {
  site: { select: { id: true, name: true } },
  secondarySite: { select: { id: true, name: true } },
  skill: { select: { id: true, name: true } },
} as const;

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
      include: includeSiteAndSkill,
      orderBy: { skill: { name: 'asc' } },
    });
  }

  async create(orderId: string, dto: CreateOperationDto) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('Заказ не найден');
    }

    try {
      return await this.prisma.operation.create({
        data: {
          quantity: dto.quantity,
          siteId: dto.siteId,
          secondarySiteId: dto.secondarySiteId,
          skillId: dto.skillId,
          orderId,
        },
        include: includeSiteAndSkill,
      });
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2003') {
        throw new BadRequestException('Указанный участок или навык не найден');
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateOperationDto) {
    try {
      return await this.prisma.operation.update({
        where: { id },
        data: {
          quantity: dto.quantity,
          siteId: dto.siteId,
          secondarySiteId: dto.secondarySiteId,
          skillId: dto.skillId,
        },
        include: includeSiteAndSkill,
      });
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new NotFoundException('Операция не найдена');
      }
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2003') {
        throw new BadRequestException('Указанный участок или навык не найден');
      }
      throw err;
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.operation.delete({ where: { id } });
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new NotFoundException('Операция не найдена');
      }
      throw err;
    }
  }
}
