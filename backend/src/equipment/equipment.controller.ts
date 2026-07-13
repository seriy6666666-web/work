import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { Role } from '../generated/prisma/enums';
import type { AuthenticatedRequest } from '../auth/jwt.strategy';
import { CreateEquipmentDto } from './dto/create-equipment.dto';
import { UpdateEquipmentDto } from './dto/update-equipment.dto';
import { EquipmentService } from './equipment.service';

function requireSiteId(req: AuthenticatedRequest): string {
  if (!req.user.siteId) {
    throw new ForbiddenException('У вас не указан участок');
  }
  return req.user.siteId;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('equipment')
export class EquipmentController {
  constructor(private equipment: EquipmentService) {}

  @Roles(Role.PRODUCTION_HEAD)
  @Get('all')
  listAll() {
    return this.equipment.listAll();
  }

  @Roles(Role.SITE_LEAD)
  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return this.equipment.listForSite(requireSiteId(req));
  }

  @Roles(Role.SITE_LEAD)
  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateEquipmentDto) {
    return this.equipment.create(requireSiteId(req), dto);
  }

  @Roles(Role.SITE_LEAD)
  @Patch(':id')
  update(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: UpdateEquipmentDto) {
    return this.equipment.update(requireSiteId(req), id, dto);
  }

  @Roles(Role.SITE_LEAD)
  @Delete(':id')
  remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.equipment.remove(requireSiteId(req), id);
  }
}
