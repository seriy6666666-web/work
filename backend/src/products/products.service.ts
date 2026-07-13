import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateProductOperationDto } from './dto/create-product-operation.dto';

const includeOps = {
  operations: {
    include: {
      skill: { select: { id: true, name: true } },
      site: { select: { id: true, name: true } },
      secondarySite: { select: { id: true, name: true } },
    },
    orderBy: { sequence: 'asc' },
  },
} as const;

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.product.findMany({ include: includeOps, orderBy: { name: 'asc' } });
  }

  async create(dto: CreateProductDto) {
    try {
      return await this.prisma.product.create({ data: { name: dto.name.trim() }, include: includeOps });
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Продукт с таким названием уже существует');
      }
      throw err;
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.product.delete({ where: { id } });
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new NotFoundException('Продукт не найден');
      }
      throw err;
    }
  }

  async addOperation(productId: string, dto: CreateProductOperationDto) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Продукт не найден');

    const count = await this.prisma.productOperation.count({ where: { productId } });
    await this.prisma.productOperation.create({
      data: {
        productId,
        skillId: dto.skillId,
        siteId: dto.siteId,
        secondarySiteId: dto.secondarySiteId || null,
        sequence: dto.sequence ?? count,
      },
    });
    return this.prisma.product.findUniqueOrThrow({ where: { id: productId }, include: includeOps });
  }

  async removeOperation(id: string) {
    try {
      await this.prisma.productOperation.delete({ where: { id } });
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new NotFoundException('Операция шаблона не найдена');
      }
      throw err;
    }
  }
}
