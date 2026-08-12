import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../generated/prisma/enums';
import { SetGoalDto } from './dto/set-goal.dto';

/** День как UTC-полночь — одна дата = одна цель на сотрудника. */
function dayUtc(input: string): Date {
  return new Date(`${input.slice(0, 10)}T00:00:00.000Z`);
}

function dayRange(from?: string, to?: string) {
  const start = from ? dayUtc(from) : dayUtc(new Date().toISOString());
  const end = to ? dayUtc(to) : new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

const includeUser = {
  user: { select: { id: true, fullName: true } },
} as const;

@Injectable()
export class GoalsService {
  constructor(private prisma: PrismaService) {}

  /** Цели сотрудников участка за период + фактическая выработка по каждому. */
  async list(siteId: string, from?: string, to?: string) {
    const { start, end } = dayRange(from, to);

    const [workers, goals] = await Promise.all([
      this.prisma.user.findMany({
        where: { siteId, role: { in: [Role.WORKER, Role.SITE_LEAD] }, archivedAt: null },
        select: { id: true, fullName: true },
        orderBy: { fullName: 'asc' },
      }),
      this.prisma.goal.findMany({
        where: { date: { gte: start, lt: end }, user: { siteId } },
        include: includeUser,
        orderBy: [{ date: 'asc' }],
      }),
    ]);

    // Факт за тот же период — из отметок о выполнении.
    const records = await this.prisma.completionRecord.findMany({
      where: {
        recordedAt: { gte: start, lt: end },
        assignment: { user: { siteId } },
      },
      select: { doneQuantity: true, recordedAt: true, assignment: { select: { userId: true } } },
    });

    const factByUserDay = new Map<string, number>();
    for (const r of records) {
      const key = `${r.assignment.userId}|${r.recordedAt.toISOString().slice(0, 10)}`;
      factByUserDay.set(key, (factByUserDay.get(key) ?? 0) + (r.doneQuantity ?? 0));
    }

    return {
      workers,
      goals: goals.map((g) => {
        const day = g.date.toISOString().slice(0, 10);
        const fact = factByUserDay.get(`${g.userId}|${day}`) ?? 0;
        return {
          id: g.id,
          userId: g.userId,
          fullName: g.user.fullName,
          date: day,
          targetQuantity: g.targetQuantity,
          fact,
          rate: g.targetQuantity > 0 ? Math.round((fact / g.targetQuantity) * 100) / 100 : null,
          missReason: g.missReason,
        };
      }),
    };
  }

  /** Задать/обновить цель. Начальник участка — только своим сотрудникам. */
  async set(siteId: string, createdById: string, dto: SetGoalDto) {
    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!user) throw new NotFoundException('Сотрудник не найден');
    if (user.siteId !== siteId) {
      throw new ForbiddenException('Сотрудник не относится к вашему участку');
    }

    const date = dayUtc(dto.date);
    return this.prisma.goal.upsert({
      where: { userId_date: { userId: dto.userId, date } },
      create: {
        userId: dto.userId,
        date,
        targetQuantity: dto.targetQuantity,
        missReason: dto.missReason ?? null,
        createdById,
      },
      update: {
        targetQuantity: dto.targetQuantity,
        missReason: dto.missReason,
      },
      include: includeUser,
    });
  }

  async remove(siteId: string, id: string) {
    const goal = await this.prisma.goal.findUnique({
      where: { id },
      include: { user: { select: { siteId: true } } },
    });
    if (!goal) throw new NotFoundException('Цель не найдена');
    if (goal.user.siteId !== siteId) {
      throw new ForbiddenException('Цель относится к другому участку');
    }
    await this.prisma.goal.delete({ where: { id } });
  }
}
