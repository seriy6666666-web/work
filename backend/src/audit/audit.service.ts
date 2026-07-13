import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';

const PAGE_SIZE = 50;

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async list(query: AuditLogQueryDto) {
    const page = query.page ?? 1;
    const where = {
      userId: query.userId,
      method: query.method,
      createdAt:
        query.from || query.to
          ? {
              gte: query.from ? new Date(query.from) : undefined,
              lte: query.to ? new Date(query.to) : undefined,
            }
          : undefined,
    };

    const [entries, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { entries, total, page, pageSize: PAGE_SIZE };
  }
}
