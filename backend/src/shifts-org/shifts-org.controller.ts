import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { Role } from '../generated/prisma/enums';
import type { AuthenticatedRequest } from '../auth/jwt.strategy';
import { SetShiftLeadDto } from './dto/set-shift-lead.dto';
import { CreateHandoverDto } from './dto/create-handover.dto';
import { ShiftsOrgService } from './shifts-org.service';

function requireSiteId(req: AuthenticatedRequest): string {
  if (!req.user.siteId) {
    throw new ForbiddenException('У вас не указан участок');
  }
  return req.user.siteId;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class ShiftsOrgController {
  constructor(private service: ShiftsOrgService) {}

  // --- Старший смены: назначает начальник производства, видят оба ---
  @Roles(Role.PRODUCTION_HEAD, Role.SITE_LEAD)
  @Get('shift-leads')
  listLeads(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('siteId') siteId?: string,
  ) {
    return this.service.listLeads(from, to, siteId);
  }

  @Roles(Role.PRODUCTION_HEAD)
  @Get('shift-leads/candidates')
  candidates(@Query('siteId') siteId: string) {
    return this.service.candidates(siteId);
  }

  // Свои назначения видит любой сотрудник: старшим смены часто ставят рабочего.
  @Get('shift-leads/me')
  myLeads(@Req() req: AuthenticatedRequest) {
    return this.service.myLeads(req.user.sub);
  }

  @Roles(Role.PRODUCTION_HEAD)
  @Post('shift-leads')
  setLead(@Body() dto: SetShiftLeadDto) {
    return this.service.setLead(dto);
  }

  @Roles(Role.PRODUCTION_HEAD)
  @Delete('shift-leads/:id')
  removeLead(@Param('id') id: string) {
    return this.service.removeLead(id);
  }

  // --- Пересменка ---
  @Roles(Role.SITE_LEAD, Role.PRODUCTION_HEAD, Role.WORKER)
  @Get('handovers')
  listHandovers(@Req() req: AuthenticatedRequest) {
    // Начальник производства получает дубль по всем участкам.
    if (req.user.role === Role.PRODUCTION_HEAD && !req.user.siteId) {
      return this.service.listAllHandovers();
    }
    return this.service.listHandovers(requireSiteId(req));
  }

  @Roles(Role.SITE_LEAD, Role.PRODUCTION_HEAD, Role.WORKER)
  @Get('handovers/summary')
  shiftSummary(@Req() req: AuthenticatedRequest) {
    return this.service.shiftSummary(requireSiteId(req));
  }

  @Roles(Role.SITE_LEAD, Role.WORKER)
  @Post('handovers')
  createHandover(@Req() req: AuthenticatedRequest, @Body() dto: CreateHandoverDto) {
    return this.service.createHandover(requireSiteId(req), req.user.sub, dto);
  }
}
