import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
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

  async listCheckedInToday(userIds: string[]): Promise<Set<string>> {
    const { start, end } = todayRange();
    const shifts = await this.prisma.shift.findMany({
      where: { userId: { in: userIds }, checkInAt: { gte: start, lt: end } },
      select: { userId: true },
    });
    return new Set(shifts.map((s) => s.userId));
  }
}
