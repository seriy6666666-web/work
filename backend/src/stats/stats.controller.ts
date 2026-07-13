import { Controller, ForbiddenException, Get, Param, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { Role } from '../generated/prisma/enums';
import type { AuthenticatedRequest } from '../auth/jwt.strategy';
import { StatsPeriodDto } from './dto/stats-period.dto';
import { StatsService } from './stats.service';

function requireSiteId(req: AuthenticatedRequest): string {
  if (!req.user.siteId) {
    throw new ForbiddenException('У вас не указан участок');
  }
  return req.user.siteId;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('stats')
export class StatsController {
  constructor(private statsService: StatsService) {}

  @Roles(Role.SITE_LEAD)
  @Get('site-ranking')
  siteRanking(@Req() req: AuthenticatedRequest, @Query() query: StatsPeriodDto) {
    return this.statsService.computeSiteRanking(requireSiteId(req), query.period);
  }

  @Roles(Role.SITE_LEAD)
  @Get('site-ranking/export')
  async exportSiteRanking(
    @Req() req: AuthenticatedRequest,
    @Query() query: StatsPeriodDto,
    @Res() res: Response,
  ) {
    const ranking = await this.statsService.computeSiteRanking(requireSiteId(req), query.period);
    const csv = await this.statsService.toCsv(ranking);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="rating.csv"');
    res.send(csv);
  }

  @Roles(Role.PRODUCTION_HEAD)
  @Get('plant-summary')
  plantSummary(@Query() query: StatsPeriodDto) {
    return this.statsService.plantSummary(query.period);
  }

  @Roles(Role.PRODUCTION_HEAD)
  @Get('site-detail/:siteId')
  siteDetail(@Param('siteId') siteId: string, @Query() query: StatsPeriodDto) {
    return this.statsService.computeSiteRanking(siteId, query.period);
  }

  @Roles(Role.PRODUCTION_HEAD)
  @Get('warnings')
  warnings() {
    return this.statsService.warnings();
  }
}
