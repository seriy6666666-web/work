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

/**
 * Окно перевода считаем днями, а не минутами.
 *
 * Даты приходят из <input type="date"> и ложатся в базу полуночью. Раньше окно
 * сравнивалось с текущим моментом: `endDate >= now()`. Для перевода «с 13-го по
 * 13-е» это условие ложно уже в 00:01, поэтому самый частый случай по ТЗ п. 3.7 —
 * попросить человека на одну смену — молча не срабатывал: начальники запрос
 * создали и подтвердили, а на участке сотрудник так и не появлялся.
 *
 * Считаем так же, как отсутствия (`isWithinToday` в absences.service.ts): день
 * целиком, от полуночи до полуночи.
 */
function activeTodayWindow() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);
  return { startDate: { lt: todayEnd }, endDate: { gte: todayStart } };
}

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

  /** ТЗ п.11: о переводах сотрудников информируем начальника производства. */
  private async notifyProductionHeads(message: string) {
    const heads = await this.prisma.user.findMany({
      where: { role: Role.PRODUCTION_HEAD },
      select: { id: true },
    });
    await this.notifications.createMany(heads.map((h) => h.id), {
      type: 'TRANSFER_INFO',
      message,
      link: '/production-head/summary',
    });
  }

  async eligibleUsers(requesterSiteId: string) {
    return this.prisma.user.findMany({
      where: {
        role: Role.WORKER,
        siteId: { not: null },
        archivedAt: null,
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
    await this.notifyProductionHeads(
      `Запрошен перевод «${transfer.user.fullName}»: «${transfer.fromSite.name}» → «${transfer.toSite.name}»`,
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

    await this.notifyProductionHeads(
      dto.approve
        ? `Перевод «${updated.user.fullName}» на участок «${updated.toSite.name}» подтверждён`
        : `Перевод «${updated.user.fullName}» на участок «${updated.toSite.name}» отклонён`,
    );

    return updated;
  }

  async getActiveIncomingTransfers(siteId: string) {
    return this.prisma.transfer.findMany({
      where: {
        toSiteId: siteId,
        status: TransferStatus.APPROVED,
        ...activeTodayWindow(),
      },
      include: includeParties,
    });
  }

  /**
   * Сотрудники, которых участок фактически видит: свои плюс временно переведённые.
   *
   * `viewerId` — тот, кто смотрит. Если у него указан адрес (площадка), он видит по
   * этому участку только своих по своему адресу. Так участок призмы, работающий на
   * ЮП26 и ЮП33, делится на двух начальников, каждый со своими людьми. Если адрес не
   * указан, видно весь участок — цилиндры и заготовки живут на одном адресе, и для
   * них ничего не меняется.
   *
   * Переведённых по адресу НЕ фильтруем: их этот начальник запросил сам и сам
   * подтверждал перевод, значит скрывать их от него неправильно, даже если их
   * домашний адрес другой.
   */
  async getEffectiveSiteUserIds(siteId: string, viewerId?: string): Promise<string[]> {
    const viewerPlatformId = viewerId ? await this.platformOf(viewerId) : null;

    const [homeUsers, transferredUsers] = await Promise.all([
      // Архивных (уволенных) в работе не показываем — их история остаётся в отчётах.
      this.prisma.user.findMany({
        where: { siteId, archivedAt: null, ...(viewerPlatformId ? { platformId: viewerPlatformId } : {}) },
        select: { id: true },
      }),
      this.prisma.transfer.findMany({
        where: {
          toSiteId: siteId,
          status: TransferStatus.APPROVED,
          ...activeTodayWindow(),
        },
        select: { userId: true },
      }),
    ]);
    return Array.from(new Set([...homeUsers.map((u) => u.id), ...transferredUsers.map((t) => t.userId)]));
  }

  /**
   * Адрес сотрудника читаем из базы, а не из токена. В токене он был бы удобнее, но
   * тогда проставленный администратором адрес начинал действовать только после
   * повторного входа — до 12 часов человек продолжал бы видеть чужие площадки.
   * Это запрос по первичному ключу, на фоне остальной работы страницы он незаметен.
   */
  async platformOf(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { platformId: true },
    });
    return user?.platformId ?? null;
  }
}
