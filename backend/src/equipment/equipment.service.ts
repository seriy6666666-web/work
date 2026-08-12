import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EquipmentStatus, Role } from '../generated/prisma/enums';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';

@Injectable()
export class EquipmentService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  listForSite(siteId: string) {
    return this.prisma.equipment.findMany({ where: { siteId }, orderBy: { name: 'asc' } });
  }

  listAll() {
    return this.prisma.equipment.findMany({
      include: { site: { select: { id: true, name: true } } },
      orderBy: [{ site: { name: 'asc' } }, { name: 'asc' }],
    });
  }

  create(siteId: string, dto: CreateEquipmentDto) {
    return this.prisma.equipment.create({
      data: {
        siteId,
        name: dto.name.trim(),
        nextMaintenanceAt: dto.nextMaintenanceAt ? new Date(dto.nextMaintenanceAt) : null,
      },
    });
  }

  private async load(siteId: string, id: string) {
    const item = await this.prisma.equipment.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Оборудование не найдено');
    if (item.siteId !== siteId) throw new ForbiddenException('Оборудование относится к другому участку');
    return item;
  }

  async update(siteId: string, id: string, dto: UpdateEquipmentDto) {
    const current = await this.load(siteId, id);

    const updated = await this.prisma.equipment.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        status: dto.status,
        nextMaintenanceAt:
          dto.nextMaintenanceAt === undefined
            ? undefined
            : dto.nextMaintenanceAt === null
              ? null
              : new Date(dto.nextMaintenanceAt),
      },
    });

    // Alert production heads when equipment newly breaks down.
    if (dto.status === EquipmentStatus.BROKEN && current.status !== EquipmentStatus.BROKEN) {
      const site = await this.prisma.site.findUnique({ where: { id: siteId } });
      const heads = await this.prisma.user.findMany({ where: { role: Role.PRODUCTION_HEAD, archivedAt: null } });
      await this.notifications.createMany(
        heads.map((h) => h.id),
        {
          type: 'ORDER_AT_RISK',
          message: `Поломка оборудования «${updated.name}» на участке «${site?.name ?? ''}»`,
          link: '/production-head/warnings',
        },
      );
    }

    return updated;
  }

  async remove(siteId: string, id: string) {
    await this.load(siteId, id);
    await this.prisma.equipment.delete({ where: { id } });
  }
}
