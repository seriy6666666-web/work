import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Role, TransferStatus } from '../generated/prisma/enums';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { RespondTransferDto } from './dto/respond-transfer.dto';

const includeParties = {
  user: { select: { id: true, fullName: true } },
  fromSite: { select: { id: true, name: true } },
  toSite: { select: { id: true, name: true } },
} as const;

@Injectable()
export class TransfersService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  private async notifySiteLeads(siteId: string, message: string) {
    const leads = await this.prisma.user.findMany({
      where: { role: Role.SITE_LEAD, siteId },
      select: { id: true },
    });
    await this.notifications.createMany(leads.map((l) => l.id), {
      type: 'TRANSFER_REQUEST',
      message,
      link: '/site-lead/transfers',
    });
  }

  async eligibleUsers(requesterSiteId: string) {
    return this.prisma.user.findMany({
      where: {
        role: Role.WORKER,
        siteId: { not: null },
        NOT: { siteId: requesterSiteId },
      },
      select: { id: true, fullName: true, site: { select: { id: true, name: true } } },
      orderBy: { fullName: 'asc' },
    });
  }

  async create(requesterSiteId: string, requesterUserId: string, dto: CreateTransferDto) {
    if (dto.toSiteId !== requesterSiteId) {
      throw new ForbiddenException('Можно запросить перевод только на свой участок');
    }
    const target = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!target || !target.siteId) {
      throw new BadRequestException('Сотрудник не найден или не привязан к участку');
    }
    if (target.siteId === requesterSiteId) {
      throw new BadRequestException('Сотрудник уже работает на вашем участке');
    }

    const transfer = await this.prisma.transfer.create({
      data: {
        userId: dto.userId,
        fromSiteId: target.siteId,
        toSiteId: dto.toSiteId,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        requestedByUserId: requesterUserId,
      },
      include: includeParties,
    });

    await this.notifySiteLeads(
      transfer.fromSiteId,
      `Запрос на перевод сотрудника «${transfer.user.fullName}» на участок «${transfer.toSite.name}»`,
    );

    return transfer;
  }

  listIncoming(siteId: string) {
    return this.prisma.transfer.findMany({
      where: { toSiteId: siteId },
      include: includeParties,
      orderBy: { createdAt: 'desc' },
    });
  }

  listOutgoing(siteId: string) {
    return this.prisma.transfer.findMany({
      where: { fromSiteId: siteId, status: TransferStatus.PENDING },
      include: includeParties,
      orderBy: { createdAt: 'desc' },
    });
  }

  async respond(requesterSiteId: string, requesterUserId: string, id: string, dto: RespondTransferDto) {
    const transfer = await this.prisma.transfer.findUnique({ where: { id } });
    if (!transfer) {
      throw new NotFoundException('Запрос на перевод не найден');
    }
    if (transfer.fromSiteId !== requesterSiteId) {
      throw new ForbiddenException('Подтвердить перевод может только участок сотрудника');
    }
    if (transfer.status !== TransferStatus.PENDING) {
      throw new BadRequestException('Запрос уже обработан');
    }

    const updated = await this.prisma.transfer.update({
      where: { id },
      data: {
        status: dto.approve ? TransferStatus.APPROVED : TransferStatus.REJECTED,
        respondedByUserId: requesterUserId,
      },
      include: includeParties,
    });

    await this.notifications.create({
      userId: updated.requestedByUserId,
      type: 'TRANSFER_RESPONSE',
      message: dto.approve
        ? `Перевод сотрудника «${updated.user.fullName}» подтверждён`
        : `Перевод сотрудника «${updated.user.fullName}» отклонён`,
      link: '/site-lead/transfers',
    });

    return updated;
  }

  async getActiveIncomingTransfers(siteId: string) {
    const now = new Date();
    return this.prisma.transfer.findMany({
      where: {
        toSiteId: siteId,
        status: TransferStatus.APPROVED,
        startDate: { lte: now },
        endDate: { gte: now },
      },
      include: includeParties,
    });
  }

  async getEffectiveSiteUserIds(siteId: string): Promise<string[]> {
    const now = new Date();
    const [homeUsers, transferredUsers] = await Promise.all([
      this.prisma.user.findMany({ where: { siteId }, select: { id: true } }),
      this.prisma.transfer.findMany({
        where: {
          toSiteId: siteId,
          status: TransferStatus.APPROVED,
          startDate: { lte: now },
          endDate: { gte: now },
        },
        select: { userId: true },
      }),
    ]);
    return Array.from(new Set([...homeUsers.map((u) => u.id), ...transferredUsers.map((t) => t.userId)]));
  }
}
