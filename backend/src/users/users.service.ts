import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../generated/prisma/enums';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

/** Ролям обязательно нужен участок. */
const SITE_BOUND_ROLES: Role[] = [Role.SITE_LEAD, Role.WORKER];
/** Начальник производства может быть привязан к участку, если сам встаёт на операции. */
const SITE_OPTIONAL_ROLES: Role[] = [Role.PRODUCTION_HEAD];

function toSafeUser<
  T extends {
    passwordHash: string;
    site: { id: string; name: string } | null;
    manager?: { id: string; fullName: string } | null;
  },
>(user: T) {
  const { passwordHash: _passwordHash, site, manager, ...rest } = user;
  return { ...rest, siteName: site?.name ?? null, managerName: manager?.fullName ?? null };
}

const includeSite = {
  site: { select: { id: true, name: true } },
  manager: { select: { id: true, fullName: true } },
} as const;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async list(withArchived = false) {
    const users = await this.prisma.user.findMany({
      where: withArchived ? {} : { archivedAt: null },
      include: includeSite,
      orderBy: { username: 'asc' },
    });
    return users.map(toSafeUser);
  }

  /**
   * Увольнение: сотрудника нельзя удалить (за ним история производства), поэтому
   * убираем его из работы — вход закрыт, из списков участка пропадает.
   */
  async archive(id: string, actorId: string) {
    if (id === actorId) {
      throw new BadRequestException('Нельзя отправить в архив самого себя');
    }
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Пользователь не найден');
    if (user.archivedAt) return toSafeUser(await this.withRelations(id));

    await this.prisma.user.update({ where: { id }, data: { archivedAt: new Date() } });
    return toSafeUser(await this.withRelations(id));
  }

  async restore(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Пользователь не найден');
    await this.prisma.user.update({ where: { id }, data: { archivedAt: null } });
    return toSafeUser(await this.withRelations(id));
  }

  private async withRelations(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, include: includeSite });
    if (!user) throw new NotFoundException('Пользователь не найден');
    return user;
  }

  async create(dto: CreateUserDto) {
    const siteId = this.resolveSiteId(dto.role, dto.siteId);
    const passwordHash = await bcrypt.hash(dto.password, 10);

    try {
      const user = await this.prisma.user.create({
        data: {
          username: dto.username,
          passwordHash,
          fullName: dto.fullName,
          role: dto.role,
          siteId,
          managerId: dto.managerId ?? null,
        },
        include: includeSite,
      });
      return toSafeUser(user);
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Логин уже занят');
      }
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2003') {
        throw new BadRequestException('Указанный участок не найден');
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Пользователь не найден');
    }

    if (dto.managerId === id) {
      throw new BadRequestException('Сотрудник не может быть руководителем самому себе');
    }

    const nextRole = dto.role ?? existing.role;
    const siteId = this.resolveSiteId(nextRole, dto.siteId ?? existing.siteId ?? undefined);
    const passwordHash = dto.password ? await bcrypt.hash(dto.password, 10) : undefined;

    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: {
          fullName: dto.fullName,
          role: dto.role,
          siteId,
          managerId: dto.managerId,
          /**
           * Новый пароль снимает блокировку за подбор. Отдельной кнопки «разблокировать»
           * нет намеренно: человек, которого заблокировало, пароль обычно и забыл, а
           * администратор в этом случае всё равно задаёт новый. Ждать пять минут с
           * новым паролем в руках было бы издевательством.
           */
          ...(passwordHash ? { passwordHash, failedLoginCount: 0, lockedUntil: null } : {}),
        },
        include: includeSite,
      });
      return toSafeUser(user);
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new NotFoundException('Пользователь не найден');
      }
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2003') {
        throw new BadRequestException('Указанный участок не найден');
      }
      throw err;
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.$transaction([
        // Компетенции и уведомления — не история производства, а текущее состояние
        // человека: уходят вместе с ним. Задания, смены и задачи трогать нельзя.
        this.prisma.competency.deleteMany({ where: { userId: id } }),
        this.prisma.notification.deleteMany({ where: { userId: id } }),
        this.prisma.user.delete({ where: { id } }),
      ]);
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new NotFoundException('Пользователь не найден');
      }
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2003') {
        throw new BadRequestException(
          'Сотрудник уже участвовал в работе (задания, смены, отсутствия) — удалить его нельзя, иначе потеряется история производства. Отправьте его в архив.',
        );
      }
      throw err;
    }
  }

  private resolveSiteId(role: Role, siteId: string | undefined): string | null {
    if (SITE_OPTIONAL_ROLES.includes(role)) {
      return siteId ?? null;
    }
    if (!SITE_BOUND_ROLES.includes(role)) {
      return null;
    }
    if (!siteId) {
      throw new BadRequestException('Для этой роли необходимо указать участок');
    }
    return siteId;
  }
}
