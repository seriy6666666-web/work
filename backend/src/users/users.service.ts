import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../generated/prisma/enums';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const SITE_BOUND_ROLES: Role[] = [Role.SITE_LEAD, Role.WORKER];

function toSafeUser<T extends { passwordHash: string; site: { id: string; name: string } | null }>(
  user: T,
) {
  const { passwordHash: _passwordHash, site, ...rest } = user;
  return { ...rest, siteName: site?.name ?? null };
}

const includeSite = { site: { select: { id: true, name: true } } } as const;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async list() {
    const users = await this.prisma.user.findMany({
      include: includeSite,
      orderBy: { username: 'asc' },
    });
    return users.map(toSafeUser);
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
          ...(passwordHash ? { passwordHash } : {}),
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
      await this.prisma.user.delete({ where: { id } });
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new NotFoundException('Пользователь не найден');
      }
      throw err;
    }
  }

  private resolveSiteId(role: Role, siteId: string | undefined): string | null {
    if (!SITE_BOUND_ROLES.includes(role)) {
      return null;
    }
    if (!siteId) {
      throw new BadRequestException('Для этой роли необходимо указать участок');
    }
    return siteId;
  }
}
