import { Body, Controller, ForbiddenException, Get, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { Role } from '../generated/prisma/enums';
import type { AuthenticatedRequest } from '../auth/jwt.strategy';
import { CompetencyService } from './competency.service';
import { SetCompetencyDto } from './dto/set-competency.dto';

function requireSiteId(req: AuthenticatedRequest): string {
  if (!req.user.siteId) {
    throw new ForbiddenException('У вас не указан участок');
  }
  return req.user.siteId;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SITE_LEAD)
@Controller()
export class CompetencyController {
  constructor(private competencyService: CompetencyService) {}

  @Get('competency-matrix')
  getMatrix(@Req() req: AuthenticatedRequest) {
    // req.user.sub нужен, чтобы ограничить выборку адресом начальника участка,
    // если он у него указан.
    return this.competencyService.getMatrix(requireSiteId(req), req.user.sub);
  }

  @Put('competency')
  setCompetency(@Req() req: AuthenticatedRequest, @Body() dto: SetCompetencyDto) {
    return this.competencyService.setCompetency(requireSiteId(req), req.user.sub, dto);
  }
}
