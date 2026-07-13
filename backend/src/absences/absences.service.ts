import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../generated/prisma/enums';
import type { JwtPayload } from '../auth/jwt.strategy';
import { CreateAbsenceDto } from './dto/create-absence.dto';

function isWithinToday(startDate: Date, endDate: Date): boolean {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);
  return startDate < todayEnd && endDate >= todayStart;
}

@Injectable()
export class AbsencesService {
  constructor(private prisma: PrismaService) {}

  async create(requester: JwtPayload, dto: CreateAbsenceDto) {
    if (dto.userId !== requester.sub) {
      if (requester.role !== Role.SITE_LEAD) {
        throw new ForbiddenException('Можно отметить отсутствие только себе или сотруднику своего участка');
      }
      const target = await this.prisma.user.findUnique({ where: { id: dto.userId } });
      if (!target || target.siteId !== requester.siteId) {
        throw new ForbiddenException('Сотрудник не относится к вашему участку');
      }
    }

    return this.prisma.absence.create({
      data: {
        type: dto.type,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        userId: dto.userId,
        createdByUserId: requester.sub,
      },
    });
  }

  listMine(userId: string) {
    return this.prisma.absence.findMany({ where: { userId }, orderBy: { startDate: 'desc' } });
  }

  listForSite(siteId: string) {
    return this.prisma.absence.findMany({
      where: { user: { siteId } },
      include: { user: { select: { id: true, fullName: true } } },
      orderBy: { startDate: 'desc' },
    });
  }

  async remove(requester: JwtPayload, id: string) {
    const absence = await this.prisma.absence.findUnique({
      where: { id },
      include: { user: { select: { siteId: true } } },
    });
    if (!absence) {
      throw new NotFoundException('Отсутствие не найдено');
    }
    const isSelf = absence.userId === requester.sub;
    const isOwnerSiteLead = requester.role === Role.SITE_LEAD && absence.user.siteId === requester.siteId;
    if (!isSelf && !isOwnerSiteLead) {
      throw new ForbiddenException('Нет доступа к этой записи');
    }
    await this.prisma.absence.delete({ where: { id } });
  }

  async isAbsentToday(userId: string): Promise<boolean> {
    const absences = await this.prisma.absence.findMany({ where: { userId } });
    return absences.some((a) => isWithinToday(a.startDate, a.endDate));
  }
}
