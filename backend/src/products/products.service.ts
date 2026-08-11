import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectStatus } from '../generated/prisma/enums';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateProductOperationDto } from './dto/create-product-operation.dto';
import { SetPlatformsDto } from './dto/set-platforms.dto';

const includeOps = {
  operations: {
    include: {
      skill: { select: { id: true, name: true } },
      site: { select: { id: true, name: true } },
      secondarySite: { select: { id: true, name: true } },
      materials: { include: { material: { select: { id: true, name: true, unit: true } } } },
    },
    orderBy: { sequence: 'asc' },
  },
  platforms: { select: { id: true, name: true } },
} as const;

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  list(includeArchived = false) {
    return this.prisma.product.findMany({
      where: includeArchived ? undefined : { status: ProjectStatus.ACTIVE },
      include: includeOps,
      orderBy: { name: 'asc' },
    });
  }

  async create(dto: CreateProductDto) {
    try {
      return await this.prisma.product.create({ data: { name: dto.name.trim() }, include: includeOps });
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Проект с таким названием уже существует');
      }
      throw err;
    }
  }

  async setArchived(id: string, archived: boolean) {
    try {
      return await this.prisma.product.update({
        where: { id },
        data: { status: archived ? ProjectStatus.ARCHIVED : ProjectStatus.ACTIVE },
        include: includeOps,
      });
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new NotFoundException('Проект не найден');
      }
      throw err;
    }
  }

  async setPlatforms(id: string, dto: SetPlatformsDto) {
    try {
      return await this.prisma.product.update({
        where: { id },
        data: { platforms: { set: dto.platformIds.map((pid) => ({ id: pid })) } },
        include: includeOps,
      });
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new NotFoundException('Проект или площадка не найдены');
      }
      throw err;
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.product.delete({ where: { id } });
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new NotFoundException('Проект не найден');
      }
      throw err;
    }
  }

  async addOperation(productId: string, dto: CreateProductOperationDto) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Проект не найден');

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

  /** Задать/обновить расход материала на 1 изделие для операции техкарты. */
  async setOperationMaterial(productOperationId: string, materialId: string, quantityPerUnit: number) {
    const op = await this.prisma.productOperation.findUnique({ where: { id: productOperationId } });
    if (!op) throw new NotFoundException('Операция техкарты не найдена');
    await this.prisma.operationMaterial.upsert({
      where: { productOperationId_materialId: { productOperationId, materialId } },
      create: { productOperationId, materialId, quantityPerUnit },
      update: { quantityPerUnit },
    });
    return this.prisma.product.findFirstOrThrow({
      where: { operations: { some: { id: productOperationId } } },
      include: includeOps,
    });
  }

  async removeOperationMaterial(id: string) {
    try {
      await this.prisma.operationMaterial.delete({ where: { id } });
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new NotFoundException('Расход материала не найден');
      }
      throw err;
    }
  }
}
