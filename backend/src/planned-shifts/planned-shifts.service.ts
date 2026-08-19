import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../generated/prisma/enums';
import { SetPlannedShiftDto } from './dto/set-planned-shift.dto';

@Injectable()
export class PlannedShiftsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Постоянный график участка: кто в какой день недели работает.
   *
   * Дат нет намеренно. График на участке повторяется, и расставлять его заново
   * каждую календарную неделю — работа, которой не должно быть.
   */
  async schedule(siteId: string) {
    const [workers, shifts] = await Promise.all([
      this.prisma.user.findMany({
        where: { siteId, role: Role.WORKER, archivedAt: null },
        select: { id: true, fullName: true },
        orderBy: { fullName: 'asc' },
      }),
      this.prisma.plannedShift.findMany({
        where: { siteId },
        select: { id: true, userId: true, weekday: true, type: true },
      }),
    ]);

    return { workers, shifts };
  }

  async set(siteId: string, dto: SetPlannedShiftDto) {
    const worker = await this.prisma.user.findFirst({
      where: { id: dto.userId, siteId, role: Role.WORKER, archivedAt: null },
      select: { id: true },
    });
    if (!worker) {
      throw new ForbiddenException('Сотрудник не относится к вашему участку');
    }

    return this.prisma.plannedShift.upsert({
      where: { userId_weekday: { userId: dto.userId, weekday: dto.weekday } },
      create: { userId: dto.userId, siteId, weekday: dto.weekday, type: dto.type },
      update: { type: dto.type },
      select: { id: true, userId: true, weekday: true, type: true },
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
