import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Role } from '../generated/prisma/enums';
import { CreateMaterialDto } from './dto/create-material.dto';
import { UpdateMaterialDto } from './dto/update-material.dto';
import { AdjustMaterialDto } from './dto/adjust-material.dto';

@Injectable()
export class MaterialsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  list() {
    return this.prisma.material.findMany({ orderBy: { name: 'asc' } });
  }

  create(dto: CreateMaterialDto) {
    return this.prisma.material.create({
      data: {
        name: dto.name.trim(),
        unit: dto.unit.trim(),
        quantity: dto.quantity ?? 0,
        lowStockThreshold: dto.lowStockThreshold ?? 0,
      },
    });
  }

  async update(id: string, dto: UpdateMaterialDto) {
    await this.ensureExists(id);
    return this.prisma.material.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        unit: dto.unit?.trim(),
        lowStockThreshold: dto.lowStockThreshold,
      },
    });
  }

  async adjust(id: string, dto: AdjustMaterialDto) {
    const current = await this.ensureExists(id);
    const newQuantity = current.quantity + dto.delta;
    if (newQuantity < 0) {
      throw new BadRequestException('Недостаточно материала на складе');
    }

    const updated = await this.prisma.material.update({
      where: { id },
      data: { quantity: newQuantity },
    });

    // Notify planners when stock newly drops to/below the threshold.
    const wasAbove = current.quantity > current.lowStockThreshold;
    const nowLow = updated.quantity <= updated.lowStockThreshold;
    if (wasAbove && nowLow) {
      const planners = await this.prisma.user.findMany({ where: { role: Role.PLANNER } });
      await this.notifications.createMany(
        planners.map((p) => p.id),
        {
          type: 'MATERIAL_LOW',
          message: `Низкий остаток материала «${updated.name}»: ${updated.quantity} ${updated.unit}`,
          link: '/planner/materials',
        },
      );
    }

    return updated;
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.material.delete({ where: { id } });
  }

  private async ensureExists(id: string) {
    const material = await this.prisma.material.findUnique({ where: { id } });
    if (!material) throw new NotFoundException('Материал не найден');
    return material;
  }
}
