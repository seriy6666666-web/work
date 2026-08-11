import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Role, ShiftType } from '../generated/prisma/enums';
import { SetShiftLeadDto } from './dto/set-shift-lead.dto';
import { CreateHandoverDto } from './dto/create-handover.dto';

function dayUtc(input: string): Date {
  return new Date(`${input.slice(0, 10)}T00:00:00.000Z`);
}

const includeLead = {
  user: { select: { id: true, fullName: true } },
  site: { select: { id: true, name: true } },
} as const;

const includeHandover = {
  fromUser: { select: { id: true, fullName: true } },
  toUser: { select: { id: true, fullName: true } },
  site: { select: { id: true, name: true } },
} as const;

@Injectable()
export class ShiftsOrgService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  // ---------- Старший смены (ТЗ п.12) ----------

  listLeads(from?: string, to?: string, siteId?: string) {
    const start = from ? dayUtc(from) : dayUtc(new Date().toISOString());
    const end = to ? dayUtc(to) : new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);

    return this.prisma.shiftLeadAssignment.findMany({
      where: { date: { gte: start, lt: end }, ...(siteId ? { siteId } : {}) },
      include: includeLead,
      orderBy: [{ date: 'asc' }, { type: 'asc' }],
    });
  }

  /** Свои назначения — чтобы работник понимал, что сегодня он старший смены. */
  myLeads(userId: string) {
    const start = dayUtc(new Date().toISOString());
    return this.prisma.shiftLeadAssignment.findMany({
      where: { userId, date: { gte: start } },
      include: includeLead,
      orderBy: { date: 'asc' },
      take: 10,
    });
  }

  /** Назначает начальник производства: кто главный в смену, когда его нет. */
  async setLead(dto: SetShiftLeadDto) {
    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!user) throw new NotFoundException('Сотрудник не найден');
    if (user.siteId !== dto.siteId) {
      throw new ForbiddenException('Сотрудник не относится к этому участку');
    }

    const date = dayUtc(dto.date);
    const lead = await this.prisma.shiftLeadAssignment.upsert({
      where: { siteId_date_type: { siteId: dto.siteId, date, type: dto.type } },
      create: { siteId: dto.siteId, userId: dto.userId, date, type: dto.type },
      update: { userId: dto.userId },
      include: includeLead,
    });

    await this.notifications.create({
      userId: dto.userId,
      type: 'SHIFT_HANDOVER',
      message: `Вы назначены старшим ${dto.type === ShiftType.NIGHT ? 'ночной' : 'дневной'} смены на ${date.toLocaleDateString('ru-RU')} (участок «${lead.site.name}»)`,
      link: '/handover',
    });

    return lead;
  }

  async removeLead(id: string) {
    const lead = await this.prisma.shiftLeadAssignment.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Назначение не найдено');
    await this.prisma.shiftLeadAssignment.delete({ where: { id } });
  }

  // ---------- Пересменка: передача дел (ТЗ п.10) ----------

  listHandovers(siteId: string, limit = 30) {
    return this.prisma.shiftHandover.findMany({
      where: { siteId },
      include: includeHandover,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /** Все передачи по всем участкам — для начальника производства (дубль). */
  listAllHandovers(limit = 50) {
    return this.prisma.shiftHandover.findMany({
      include: includeHandover,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Передача дел: адресату (старший следующей смены) и дублем начальнику
   * производства — как требует ТЗ.
   */
  async createHandover(siteId: string, fromUserId: string, dto: CreateHandoverDto) {
    const toUserId = dto.toUserId ?? (await this.findNextShiftLead(siteId, fromUserId));

    const handover = await this.prisma.shiftHandover.create({
      data: {
        siteId,
        fromUserId,
        toUserId: toUserId ?? null,
        message: dto.message.trim(),
      },
      include: includeHandover,
    });

    const recipients = new Set<string>();
    if (toUserId) recipients.add(toUserId);
    const heads = await this.prisma.user.findMany({
      where: { role: Role.PRODUCTION_HEAD },
      select: { id: true },
    });
    for (const h of heads) recipients.add(h.id);
    recipients.delete(fromUserId);

    await this.notifications.createMany([...recipients], {
      type: 'SHIFT_HANDOVER',
      message: `Передача дел от ${handover.fromUser.fullName} (участок «${handover.site.name}»)`,
      link: '/handover',
    });

    return handover;
  }

  /**
   * Кому передавать: ближайший назначенный старший смены на этом участке,
   * кроме самого передающего.
   */
  private async findNextShiftLead(siteId: string, exceptUserId: string): Promise<string | null> {
    const today = dayUtc(new Date().toISOString());
    const lead = await this.prisma.shiftLeadAssignment.findFirst({
      where: { siteId, date: { gte: today }, userId: { not: exceptUserId } },
      orderBy: [{ date: 'asc' }, { type: 'asc' }],
    });
    if (lead) return lead.userId;

    // Старший не назначен — передаём начальнику участка.
    const siteLead = await this.prisma.user.findFirst({
      where: { siteId, role: Role.SITE_LEAD, id: { not: exceptUserId } },
      select: { id: true },
    });
    return siteLead?.id ?? null;
  }
}
