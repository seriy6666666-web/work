import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../generated/prisma/enums';

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

/** Границы периода журнала: [from 00:00, to 23:59:59]. */
function periodRange(from?: string, to?: string) {
  const start = from ? new Date(`${from.slice(0, 10)}T00:00:00`) : new Date();
  if (!from) start.setDate(start.getDate() - 7);
  start.setHours(0, 0, 0, 0);

  const end = to ? new Date(`${to.slice(0, 10)}T00:00:00`) : new Date();
  end.setHours(0, 0, 0, 0);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export interface JournalEntry {
  userId: string;
  fullName: string;
  date: string;
  checkInAt: string;
  checkOutAt: string | null;
  hours: number | null;
}

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  getToday(userId: string) {
    const { start, end } = todayRange();
    return this.prisma.shift.findFirst({
      where: { userId, checkInAt: { gte: start, lt: end } },
      orderBy: { checkInAt: 'asc' },
    });
  }

  async checkIn(userId: string) {
    const existing = await this.getToday(userId);
    if (existing) {
      return existing;
    }
    return this.prisma.shift.create({ data: { userId } });
  }

  /** Отметка ухода. Повторный уход не перезаписывает время — фиксируем первое. */
  async checkOut(userId: string) {
    const shift = await this.getToday(userId);
    if (!shift) {
      throw new BadRequestException('Сначала отметьте приход');
    }
    if (shift.checkOutAt) {
      return shift;
    }
    return this.prisma.shift.update({
      where: { id: shift.id },
      data: { checkOutAt: new Date() },
    });
  }

  async listCheckedInToday(userIds: string[]): Promise<Set<string>> {
    const { start, end } = todayRange();
    const shifts = await this.prisma.shift.findMany({
      where: { userId: { in: userIds }, checkInAt: { gte: start, lt: end } },
      select: { userId: true },
    });
    return new Set(shifts.map((s) => s.userId));
  }

  /** Журнал приходов-уходов по сотрудникам участка за период. */
  async journal(siteId: string, from?: string, to?: string): Promise<JournalEntry[]> {
    const { start, end } = periodRange(from, to);

    const shifts = await this.prisma.shift.findMany({
      where: {
        checkInAt: { gte: start, lt: end },
        // Начальник участка тоже работает руками — его смены попадают в журнал.
        user: { siteId, role: { in: [Role.WORKER, Role.SITE_LEAD, Role.PRODUCTION_HEAD] } },
      },
      include: { user: { select: { id: true, fullName: true } } },
      orderBy: [{ checkInAt: 'desc' }],
    });

    return shifts.map((s) => ({
      userId: s.user.id,
      fullName: s.user.fullName,
      date: s.checkInAt.toISOString().slice(0, 10),
      checkInAt: s.checkInAt.toISOString(),
      checkOutAt: s.checkOutAt ? s.checkOutAt.toISOString() : null,
      hours: s.checkOutAt
        ? Math.round(((s.checkOutAt.getTime() - s.checkInAt.getTime()) / 3_600_000) * 100) / 100
        : null,
    }));
  }

  /** Тот же журнал в CSV (для выгрузки начальником участка). */
  toCsv(entries: JournalEntry[]): string {
    const time = (iso: string | null) =>
      iso ? new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : '';

    const header = 'ФИО,Дата,Приход,Уход,Отработано (ч)';
    const rows = entries.map((e) =>
      [
        `"${e.fullName.replace(/"/g, '""')}"`,
        e.date.split('-').reverse().join('.'),
        time(e.checkInAt),
        time(e.checkOutAt),
        e.hours ?? '',
      ].join(','),
    );
    // BOM — чтобы Excel открыл кириллицу без «кракозябр».
    return '﻿' + [header, ...rows].join('\n');
  }
}
