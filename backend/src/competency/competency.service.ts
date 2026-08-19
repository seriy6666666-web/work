import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TransfersService } from '../transfers/transfers.service';
import { AbsencesService } from '../absences/absences.service';
import { SetCompetencyDto } from './dto/set-competency.dto';

@Injectable()
export class CompetencyService {
  constructor(
    private prisma: PrismaService,
    private transfersService: TransfersService,
    private absencesService: AbsencesService,
  ) {}

  async getMatrix(siteId: string, viewerId: string) {
    const userIds = await this.transfersService.getEffectiveSiteUserIds(siteId, viewerId);

    const [skills, users, competencies] = await Promise.all([
      this.prisma.skill.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, fullName: true },
        orderBy: { fullName: 'asc' },
      }),
      this.prisma.competency.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, skillId: true, level: true },
      }),
    ]);

    const usersWithAbsence = await Promise.all(
      users.map(async (user) => ({
        ...user,
        isAbsentToday: await this.absencesService.isAbsentToday(user.id),
      })),
    );

    return { skills, users: usersWithAbsence, competencies };
  }

  async setCompetency(siteId: string, viewerId: string, dto: SetCompetencyDto) {
    const eligibleUserIds = await this.transfersService.getEffectiveSiteUserIds(siteId, viewerId);
    if (!eligibleUserIds.includes(dto.userId)) {
      throw new ForbiddenException('Сотрудник не относится к вашему участку');
    }

    if (dto.level) {
      await this.prisma.competency.upsert({
        where: { userId_skillId: { userId: dto.userId, skillId: dto.skillId } },
        create: { userId: dto.userId, skillId: dto.skillId, level: dto.level },
        update: { level: dto.level },
      });
    } else {
      // Уровень не указан — допуска нет. Отдельного значения для этого не
      // храним: иначе на каждого человека и каждый навык была бы строка.
      await this.prisma.competency.deleteMany({
        where: { userId: dto.userId, skillId: dto.skillId },
      });
    }

    return { userId: dto.userId, skillId: dto.skillId, level: dto.level ?? null };
  }
}
