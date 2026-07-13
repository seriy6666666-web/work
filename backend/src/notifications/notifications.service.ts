import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { NotificationType } from '../generated/prisma/enums';

interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  message: string;
  link?: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private events: EventsGateway,
  ) {}

  /** Create a notification and push a live event to the target user. */
  async create(input: CreateNotificationInput) {
    const notification = await this.prisma.notification.create({ data: input });
    this.events.emitNotification(input.userId);
    return notification;
  }

  /** Create the same notification for several users (e.g. a whole role). */
  async createMany(userIds: string[], input: Omit<CreateNotificationInput, 'userId'>) {
    await Promise.all(userIds.map((userId) => this.create({ ...input, userId })));
  }

  list(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async unreadCount(userId: string) {
    const count = await this.prisma.notification.count({ where: { userId, read: false } });
    return { count };
  }

  async markRead(userId: string, id: string) {
    await this.prisma.notification.updateMany({ where: { id, userId }, data: { read: true } });
    return { ok: true };
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
    return { ok: true };
  }
}
