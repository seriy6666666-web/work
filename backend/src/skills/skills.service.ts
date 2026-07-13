import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSkillDto } from './dto/create-skill.dto';
import { UpdateSkillDto } from './dto/update-skill.dto';

@Injectable()
export class SkillsService {
  constructor(private prisma: PrismaService) {}

  list() {
    return this.prisma.skill.findMany({ orderBy: { name: 'asc' } });
  }

  async create(dto: CreateSkillDto) {
    try {
      return await this.prisma.skill.create({ data: { name: dto.name } });
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Навык с таким названием уже существует');
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateSkillDto) {
    try {
      return await this.prisma.skill.update({ where: { id }, data: { name: dto.name } });
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new NotFoundException('Навык не найден');
      }
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Навык с таким названием уже существует');
      }
      throw err;
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.skill.delete({ where: { id } });
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new NotFoundException('Навык не найден');
      }
      if (err instanceof PrismaClientKnownRequestError && err.code === 'P2003') {
        throw new ConflictException('Навык используется в операциях — сначала удалите или измените их');
      }
      throw err;
    }
  }
}
