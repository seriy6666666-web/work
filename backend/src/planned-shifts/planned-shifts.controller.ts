import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { Role } from '../generated/prisma/enums';
import type { AuthenticatedRequest } from '../auth/jwt.strategy';
import { SetPlannedShiftDto } from './dto/set-planned-shift.dto';
import { PlannedShiftsService } from './planned-shifts.service';

function requireSiteId(req: AuthenticatedRequest): string {
  if (!req.user.siteId) {
    throw new ForbiddenException('У вас не указан участок');
  }
  return req.user.siteId;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SITE_LEAD)
@Controller('planned-shifts')
export class PlannedShiftsController {
  constructor(private shifts: PlannedShiftsService) {}

  @Get('week')
  week(@Req() req: AuthenticatedRequest, @Query('start') start: string) {
    return this.shifts.week(requireSiteId(req), start ?? new Date().toISOString());
  }

  @Post()
  set(@Req() req: AuthenticatedRequest, @Body() dto: SetPlannedShiftDto) {
    return this.shifts.set(requireSiteId(req), dto);
  }

  @Delete(':id')
  remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.shifts.remove(requireSiteId(req), id);
  }
}
