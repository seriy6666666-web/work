import { Controller, ForbiddenException, Get, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { Role } from '../generated/prisma/enums';
import type { AuthenticatedRequest } from '../auth/jwt.strategy';
import { AttendanceService } from './attendance.service';

function requireSiteId(req: AuthenticatedRequest): string {
  if (!req.user.siteId) {
    throw new ForbiddenException('У вас не указан участок');
  }
  return req.user.siteId;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private attendanceService: AttendanceService) {}

  // Руководители работают наравне, поэтому тоже отмечают приход и уход.
  @Roles(Role.WORKER, Role.SITE_LEAD, Role.PRODUCTION_HEAD)
  @Get('today')
  getToday(@Req() req: AuthenticatedRequest) {
    return this.attendanceService.getToday(req.user.sub);
  }

  @Roles(Role.WORKER, Role.SITE_LEAD, Role.PRODUCTION_HEAD)
  @Post('check-in')
  checkIn(@Req() req: AuthenticatedRequest) {
    return this.attendanceService.checkIn(req.user.sub);
  }

  @Roles(Role.WORKER, Role.SITE_LEAD, Role.PRODUCTION_HEAD)
  @Post('check-out')
  checkOut(@Req() req: AuthenticatedRequest) {
    return this.attendanceService.checkOut(req.user.sub);
  }

  /** Журнал приходов-уходов по своему участку. */
  @Roles(Role.SITE_LEAD)
  @Get('journal')
  journal(
    @Req() req: AuthenticatedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.attendanceService.journal(requireSiteId(req), from, to);
  }

  @Roles(Role.SITE_LEAD)
  @Get('journal/export')
  async exportJournal(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const entries = await this.attendanceService.journal(requireSiteId(req), from, to);
    const csv = this.attendanceService.toCsv(entries);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="attendance.csv"');
    res.send(csv);
  }
}
