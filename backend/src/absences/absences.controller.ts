import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { Role } from '../generated/prisma/enums';
import type { AuthenticatedRequest } from '../auth/jwt.strategy';
import { AbsencesService } from './absences.service';
import { CreateAbsenceDto } from './dto/create-absence.dto';

function requireSiteId(req: AuthenticatedRequest): string {
  if (!req.user.siteId) {
    throw new ForbiddenException('У вас не указан участок');
  }
  return req.user.siteId;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.WORKER, Role.SITE_LEAD)
@Controller('absences')
export class AbsencesController {
  constructor(private absencesService: AbsencesService) {}

  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateAbsenceDto) {
    return this.absencesService.create(req.user, dto);
  }

  @Get('mine')
  @Roles(Role.WORKER)
  listMine(@Req() req: AuthenticatedRequest) {
    return this.absencesService.listMine(req.user.sub);
  }

  @Get('site')
  @Roles(Role.SITE_LEAD)
  listForSite(@Req() req: AuthenticatedRequest) {
    return this.absencesService.listForSite(requireSiteId(req));
  }

  @Delete(':id')
  remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.absencesService.remove(req.user, id);
  }
}
