import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { Role } from '../generated/prisma/enums';
import type { AuthenticatedRequest } from '../auth/jwt.strategy';
import { AttendanceService } from './attendance.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.WORKER)
@Controller('attendance')
export class AttendanceController {
  constructor(private attendanceService: AttendanceService) {}

  @Get('today')
  getToday(@Req() req: AuthenticatedRequest) {
    return this.attendanceService.getToday(req.user.sub);
  }

  @Post('check-in')
  checkIn(@Req() req: AuthenticatedRequest) {
    return this.attendanceService.checkIn(req.user.sub);
  }
}
