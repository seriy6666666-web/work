import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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

  /**
   * Материал, который где-то используется, удалять нельзя: на нём висят нормы
   * расхода в техкартах и в уже запущенных заказах, а по ним считается списание.
   *
   * Раньше проверки не было, и Prisma падала на внешнем ключе — планировщик
   * получал «Внутренняя ошибка сервера» без единого намёка, что делать. Заказы в
   * этом же приложении отвечают на такое понятным «У заказа есть операции —
   * сначала удалите их»; материалы просто отставали.
   */
  async removeMaterial(id: string) {
    const material = await this.ensureMaterial(id);

    const [techcardReqs, operationReqs, stocks] = await Promise.all([
      this.prisma.operationMaterial.count({ where: { materialId: id } }),
      this.prisma.operationMaterialReq.count({ where: { materialId: id } }),
      this.prisma.materialStock.count({ where: { materialId: id } }),
    ]);

    const used: string[] = [];
    if (techcardReqs > 0) used.push(`техкарты изделий (${techcardReqs})`);
    if (operationReqs > 0) used.push(`операции заказов (${operationReqs})`);
    if (used.length > 0) {
      throw new ConflictException(
        `«${material.name}» используется: ${used.join(', ')}. Сначала уберите материал ` +
          'из техкарт и операций — иначе списание по этим нормам считать будет не по чему.',
      );
    }

    /**
     * Остатки — не препятствие: это склад самого материала, он уходит вместе с ним.
     * Удаляем в одной транзакции, чтобы не остался остаток без материала.
     */
    await this.prisma.$transaction([
      this.prisma.materialStock.deleteMany({ where: { materialId: id } }),
      this.prisma.material.delete({ where: { id } }),
    ]);
    return { deletedStocks: stocks };
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

    const planners = await this.prisma.user.findMany({ where: { role: Role.PLANNER, archivedAt: null } });
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
