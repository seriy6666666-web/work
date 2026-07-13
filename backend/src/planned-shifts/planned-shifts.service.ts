import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../generated/prisma/enums';
import { SetPlannedShiftDto } from './dto/set-planned-shift.dto';

/** Normalize any date-ish string to UTC midnight so one calendar day == one key. */
function dayUtc(input: string): Date {
  return new Date(`${input.slice(0, 10)}T00:00:00.000Z`);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

@Injectable()
export class PlannedShiftsService {
  constructor(private prisma: PrismaService) {}

  /** Weekly roster + planned shifts for a site, starting at `start` (7 days). */
  async week(siteId: string, start: string) {
    const weekStart = dayUtc(start);
    const weekEnd = addDays(weekStart, 7);

    const [workers, shifts] = await Promise.all([
      this.prisma.user.findMany({
        where: { siteId, role: Role.WORKER },
        select: { id: true, fullName: true },
        orderBy: { fullName: 'asc' },
      }),
      this.prisma.plannedShift.findMany({
        where: { siteId, date: { gte: weekStart, lt: weekEnd } },
        select: { id: true, userId: true, date: true, type: true },
      }),
    ]);

    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i).toISOString());
    return { weekStart: weekStart.toISOString(), days, workers, shifts };
  }

  async set(siteId: string, dto: SetPlannedShiftDto) {
    const worker = await this.prisma.user.findFirst({
      where: { id: dto.userId, siteId, role: Role.WORKER },
      select: { id: true },
    });
    if (!worker) {
      throw new ForbiddenException('Сотрудник не относится к вашему участку');
    }

    const date = dayUtc(dto.date);
    return this.prisma.plannedShift.upsert({
      where: { userId_date: { userId: dto.userId, date } },
      create: { userId: dto.userId, siteId, date, type: dto.type },
      update: { type: dto.type },
      select: { id: true, userId: true, date: true, type: true },
    });
  }

  async remove(siteId: string, id: string) {
    const shift = await this.prisma.plannedShift.findUnique({ where: { id } });
    if (!shift) throw new NotFoundException('Смена не найдена');
    if (shift.siteId !== siteId) {
      throw new ForbiddenException('Смена относится к другому участку');
    }
    await this.prisma.plannedShift.delete({ where: { id } });
  }
}
