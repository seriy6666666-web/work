import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';

@Injectable()
export class SitesService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.site.findMany({ orderBy: { name: 'asc' } });
  }

  async create(dto: CreateSiteDto) {
    try {
      return await this.prisma.site.create({ data: { name: dto.name } });
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Участок с таким названием уже существует');
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateSiteDto) {
    try {
      return await this.prisma.site.update({ where: { id }, data: { name: dto.name } });
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new NotFoundException('Участок не найден');
      }
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Участок с таким названием уже существует');
      }
      throw err;
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.site.delete({ where: { id } });
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new NotFoundException('Участок не найден');
      }
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2003') {
        throw new ConflictException('На участке есть сотрудники — сначала перенесите их на другой участок');
      }
      throw err;
    }
  }
}
