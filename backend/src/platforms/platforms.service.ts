import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePlatformDto } from './dto/create-platform.dto';
import { UpdatePlatformDto } from './dto/update-platform.dto';

@Injectable()
export class PlatformsService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.platform.findMany({ orderBy: { name: 'asc' } });
  }

  async create(dto: CreatePlatformDto) {
    try {
      return await this.prisma.platform.create({
        data: { name: dto.name.trim(), address: dto.address?.trim() || null },
      });
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Площадка с таким названием уже существует');
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdatePlatformDto) {
    try {
      return await this.prisma.platform.update({
        where: { id },
        data: {
          name: dto.name?.trim(),
          address: dto.address === undefined ? undefined : dto.address?.trim() || null,
        },
      });
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new NotFoundException('Площадка не найдена');
      }
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Площадка с таким названием уже существует');
      }
      throw err;
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.platform.delete({ where: { id } });
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new NotFoundException('Площадка не найдена');
      }
      throw err;
    }
  }
}
