import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { FeedbackMood, FeedbackStatus, FeedbackType, Role } from '../generated/prisma/enums';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { UpdateFeedbackDto } from './dto/update-feedback.dto';

export const TYPE_LABELS: Record<FeedbackType, string> = {
  PROBLEM: 'Проблема',
  IDEA: 'Идея',
  COMPLAINT: 'Жалоба',
  SHIFT: 'Отклик о смене',
};

export const MOOD_LABELS: Record<FeedbackMood, string> = {
  GOOD: 'Нормально',
  SO_SO: 'Были заминки',
  BAD: 'Мешало работать',
};

export const STATUS_LABELS: Record<FeedbackStatus, string> = {
  NEW: 'Новое',
  IN_PROGRESS: 'В работе',
  DONE: 'Сделано',
  REJECTED: 'Отклонено',
};

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Администратор',
  PLANNER: 'Планировщик',
  PRODUCTION_HEAD: 'Начальник производства',
  SITE_LEAD: 'Начальник участка',
  WORKER: 'Сотрудник',
};

const include = {
  author: { select: { id: true, fullName: true } },
  site: { select: { id: true, name: true } },
  repliedBy: { select: { id: true, fullName: true } },
} as const;

export interface FeedbackFilters {
  type?: FeedbackType;
  status?: FeedbackStatus;
  siteId?: string;
  from?: string;
  to?: string;
}

@Injectable()
export class FeedbackService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async create(
    user: { sub: string; role: Role; siteId: string | null },
    dto: CreateFeedbackDto,
  ) {
    const message = dto.message?.trim();
    if (!message && !dto.mood) {
      throw new BadRequestException('Напишите, что случилось, или оцените смену');
    }

    return this.prisma.feedback.create({
      data: {
        type: dto.type,
        mood: dto.mood ?? null,
        message: message || null,
        screen: dto.screen ?? null,
        anonymous: dto.anonymous ?? false,
        // Анонимно — значит анонимно: автора не сохраняем вовсе, иначе обещание ложное.
        authorId: dto.anonymous ? null : user.sub,
        authorRole: user.role,
        siteId: user.siteId,
      },
    });
  }

  list(filters: FeedbackFilters) {
    return this.prisma.feedback.findMany({
      where: this.whereFrom(filters),
      include,
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  private whereFrom(filters: FeedbackFilters) {
    const createdAt: { gte?: Date; lt?: Date } = {};
    if (filters.from) createdAt.gte = new Date(`${filters.from.slice(0, 10)}T00:00:00.000Z`);
    if (filters.to) {
      const end = new Date(`${filters.to.slice(0, 10)}T00:00:00.000Z`);
      end.setUTCDate(end.getUTCDate() + 1);
      createdAt.lt = end;
    }
    return {
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.siteId ? { siteId: filters.siteId } : {}),
      ...(createdAt.gte || createdAt.lt ? { createdAt } : {}),
    };
  }

  /** Сводка: сколько новых и как менялось настроение по дням. */
  async summary(filters: FeedbackFilters) {
    const items = await this.prisma.feedback.findMany({
      where: this.whereFrom(filters),
      select: { type: true, mood: true, status: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const byDay = new Map<string, { good: number; soSo: number; bad: number }>();
    for (const f of items) {
      if (!f.mood) continue;
      const day = f.createdAt.toISOString().slice(0, 10);
      const bucket = byDay.get(day) ?? { good: 0, soSo: 0, bad: 0 };
      if (f.mood === 'GOOD') bucket.good++;
      else if (f.mood === 'SO_SO') bucket.soSo++;
      else bucket.bad++;
      byDay.set(day, bucket);
    }

    return {
      total: items.length,
      newCount: items.filter((f) => f.status === 'NEW').length,
      byType: {
        PROBLEM: items.filter((f) => f.type === 'PROBLEM').length,
        IDEA: items.filter((f) => f.type === 'IDEA').length,
        COMPLAINT: items.filter((f) => f.type === 'COMPLAINT').length,
        SHIFT: items.filter((f) => f.type === 'SHIFT').length,
      },
      moodByDay: [...byDay.entries()].map(([date, b]) => ({ date, ...b })),
    };
  }

  async update(id: string, adminId: string, dto: UpdateFeedbackDto) {
    const existing = await this.prisma.feedback.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Обращение не найдено');

    const reply = dto.reply?.trim();
    const feedback = await this.prisma.feedback.update({
      where: { id },
      data: {
        ...(dto.status ? { status: dto.status } : {}),
        ...(reply !== undefined
          ? { reply: reply || null, repliedAt: reply ? new Date() : null, repliedById: reply ? adminId : null }
          : {}),
      },
      include,
    });

    // Человек должен видеть, что его прочитали — иначе поток обращений иссякнет.
    // У анонимных адресата нет по определению.
    if (reply && existing.authorId && reply !== existing.reply) {
      await this.notifications.create({
        userId: existing.authorId,
        type: 'FEEDBACK_REPLY',
        message: `Ответ на ваше обращение: ${reply.slice(0, 120)}`,
        link: '/my-feedback',
      });
    }

    return feedback;
  }

  /** Свои обращения — чтобы человек видел ответ, а не только уведомление. */
  listMine(userId: string) {
    return this.prisma.feedback.findMany({
      where: { authorId: userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  toCsv(items: Awaited<ReturnType<FeedbackService['list']>>): string {
    const esc = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const header = 'Дата,Тип,Оценка смены,Кто,Роль,Участок,Экран,Статус,Текст,Ответ';
    const rows = items.map((f) =>
      [
        new Date(f.createdAt).toLocaleString('ru-RU'),
        TYPE_LABELS[f.type],
        f.mood ? MOOD_LABELS[f.mood] : '',
        f.anonymous ? 'анонимно' : (f.author?.fullName ?? ''),
        ROLE_LABELS[f.authorRole],
        f.site?.name ?? '',
        f.screen ?? '',
        STATUS_LABELS[f.status],
        esc(f.message ?? ''),
        esc(f.reply ?? ''),
      ].join(','),
    );
    // BOM — иначе Excel открывает кириллицу кракозябрами.
    return '﻿' + [header, ...rows].join('\r\n');
  }
}
