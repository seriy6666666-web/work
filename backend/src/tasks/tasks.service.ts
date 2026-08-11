import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Role, TaskStatus } from '../generated/prisma/enums';
import { CreateTaskDto } from './dto/create-task.dto';

const includeParties = {
  assignee: { select: { id: true, fullName: true, role: true } },
  createdBy: { select: { id: true, fullName: true } },
} as const;

/** Кому руководитель может ставить задачи, кроме себя. */
const ASSIGNABLE_ROLES: Role[] = [Role.SITE_LEAD, Role.PRODUCTION_HEAD];

@Injectable()
export class TasksService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  /** Задачи, где я исполнитель или автор. */
  list(userId: string) {
    return this.prisma.task.findMany({
      where: { OR: [{ assigneeId: userId }, { createdById: userId }] },
      include: includeParties,
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }, { createdAt: 'desc' }],
    });
  }

  /** Кому можно назначить задачу (руководители + я сам). */
  assignableUsers() {
    return this.prisma.user.findMany({
      where: { role: { in: ASSIGNABLE_ROLES } },
      select: { id: true, fullName: true, role: true },
      orderBy: { fullName: 'asc' },
    });
  }

  async create(userId: string, dto: CreateTaskDto) {
    const assigneeId = dto.assigneeId ?? userId;

    if (assigneeId !== userId) {
      const assignee = await this.prisma.user.findUnique({ where: { id: assigneeId } });
      if (!assignee) throw new NotFoundException('Исполнитель не найден');
      if (!ASSIGNABLE_ROLES.includes(assignee.role)) {
        throw new ForbiddenException('Задачу можно поставить только себе или руководителю');
      }
    }

    const task = await this.prisma.task.create({
      data: {
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        assigneeId,
        createdById: userId,
      },
      include: includeParties,
    });

    // Себе задачу поставил — уведомлять не о чем.
    if (assigneeId !== userId) {
      await this.notifications.create({
        userId: assigneeId,
        type: 'TASK_ASSIGNED',
        message: `Новая задача: «${task.title}»`,
        link: '/tasks',
      });
    }

    return task;
  }

  /** Отметить выполненной / вернуть в работу. Может исполнитель или автор. */
  async setStatus(userId: string, id: string, done: boolean) {
    const task = await this.load(userId, id);
    return this.prisma.task.update({
      where: { id: task.id },
      data: {
        status: done ? TaskStatus.DONE : TaskStatus.OPEN,
        completedAt: done ? new Date() : null,
      },
      include: includeParties,
    });
  }

  async remove(userId: string, id: string) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Задача не найдена');
    if (task.createdById !== userId) {
      throw new ForbiddenException('Удалить задачу может только тот, кто её поставил');
    }
    await this.prisma.task.delete({ where: { id } });
  }

  private async load(userId: string, id: string) {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) throw new NotFoundException('Задача не найдена');
    if (task.assigneeId !== userId && task.createdById !== userId) {
      throw new ForbiddenException('Это не ваша задача');
    }
    return task;
  }
}
