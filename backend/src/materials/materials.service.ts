import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Role } from '../generated/prisma/enums';
import { CreateMaterialDto } from './dto/create-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { UpsertStockDto } from './dto/upsert-stock.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';

const stockInclude = {
  material: { select: { id: true, name: true, unit: true } },
  platform: { select: { id: true, name: true } },
  project: { select: { id: true, name: true } },
} as const;

@Injectable()
export class MaterialsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  // --- Каталог материалов ---
  listCatalog() {
    return this.prisma.material.findMany({ orderBy: { name: 'asc' } });
  }

  createMaterial(dto: CreateMaterialDto) {
    return this.prisma.material.create({
      data: { name: dto.name.trim(), unit: dto.unit.trim() },
    });
  }

  async updateMaterial(id: string, dto: UpdateMaterialDto) {
    await this.ensureMaterial(id);
    return this.prisma.material.update({
      where: { id },
      data: { name: dto.name?.trim(), unit: dto.unit?.trim() },
    });
  }

  async removeMaterial(id: string) {
    await this.ensureMaterial(id);
    await this.prisma.material.delete({ where: { id } });
  }

  // --- Остатки в разрезе (площадка × проект) ---
  listStocks() {
    return this.prisma.materialStock.findMany({
      include: stockInclude,
      orderBy: [{ platform: { name: 'asc' } }, { project: { name: 'asc' } }, { material: { name: 'asc' } }],
    });
  }

  /** Создать/обновить запись остатка для конкретного разреза. */
  upsertStock(dto: UpsertStockDto) {
    return this.prisma.materialStock.upsert({
      where: {
        materialId_platformId_projectId: {
          materialId: dto.materialId,
          platformId: dto.platformId,
          projectId: dto.projectId,
        },
      },
      create: {
        materialId: dto.materialId,
        platformId: dto.platformId,
        projectId: dto.projectId,
        quantity: dto.quantity ?? 0,
        lowStockThreshold: dto.lowStockThreshold ?? 0,
      },
      update: {
        quantity: dto.quantity,
        lowStockThreshold: dto.lowStockThreshold,
      },
      include: stockInclude,
    });
  }

  async adjustStock(id: string, dto: AdjustStockDto) {
    const before = await this.prisma.materialStock.findUnique({ where: { id }, include: stockInclude });
    if (!before) throw new NotFoundException('Запись остатка не найдена');

    // Атомарное изменение остатка (без гонок под нагрузкой).
    const updated = await this.prisma.materialStock.update({
      where: { id },
      data: { quantity: { increment: dto.delta } },
      include: stockInclude,
    });

    await this.maybeNotifyLow(before.quantity, updated);
    return updated;
  }

  removeStock(id: string) {
    return this.prisma.materialStock.delete({ where: { id } }).then(() => undefined);
  }

  /**
   * Автосписание по факту выполнения. `delta` — знаковое изменение произведённого
   * количества (при исправлении может быть отрицательным = возврат материала).
   * Атомарно уменьшает/увеличивает остаток нужного разреза.
   */
  async consume(projectId: string, platformId: string, materialId: string, quantity: number) {
    if (!quantity) return;

    const existing = await this.prisma.materialStock.findUnique({
      where: { materialId_platformId_projectId: { materialId, platformId, projectId } },
    });

    if (!existing) {
      // Остаток для разреза не заведён — фиксируем дефицит, чтобы он был виден.
      await this.prisma.materialStock
        .create({ data: { materialId, platformId, projectId, quantity: -quantity } })
        .catch(() => undefined);
      return;
    }

    const updated = await this.prisma.materialStock.update({
      where: { id: existing.id },
      data: { quantity: { decrement: quantity } },
      include: stockInclude,
    });

    await this.maybeNotifyLow(existing.quantity, updated);
  }

  /** Уведомить планировщиков, если остаток впервые опустился до/ниже порога. */
  private async maybeNotifyLow(
    before: number,
    stock: { quantity: number; lowStockThreshold: number; material: { name: string; unit: string }; platform: { name: string }; project: { name: string } },
  ) {
    const wasAbove = before > stock.lowStockThreshold;
    const nowLow = stock.quantity <= stock.lowStockThreshold;
    if (!wasAbove || !nowLow) return;

    const planners = await this.prisma.user.findMany({ where: { role: Role.PLANNER } });
    await this.notifications.createMany(
      planners.map((p) => p.id),
      {
        type: 'MATERIAL_LOW',
        message: `Низкий остаток «${stock.material.name}» на площадке «${stock.platform.name}» (проект «${stock.project.name}»): ${stock.quantity} ${stock.material.unit}`,
        link: '/planner/materials',
      },
    );
  }

  private async ensureMaterial(id: string) {
    const material = await this.prisma.material.findUnique({ where: { id } });
    if (!material) throw new NotFoundException('Материал не найден');
    return material;
  }
}
