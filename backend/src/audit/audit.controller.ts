import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { Role } from '../generated/prisma/enums';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';
import { AuditService } from './audit.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('audit-log')
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Roles(Role.ADMIN)
  @Get()
  list(@Query() query: AuditLogQueryDto) {
    return this.auditService.list(query);
  }
}
