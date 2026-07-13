import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { Role } from '../generated/prisma/enums';
import type { AuthenticatedRequest } from '../auth/jwt.strategy';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { RespondTransferDto } from './dto/respond-transfer.dto';
import { TransfersService } from './transfers.service';

function requireSiteId(req: AuthenticatedRequest): string {
  if (!req.user.siteId) {
    throw new ForbiddenException('У вас не указан участок');
  }
  return req.user.siteId;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SITE_LEAD)
@Controller('transfers')
export class TransfersController {
  constructor(private transfersService: TransfersService) {}

  @Get('eligible-users')
  eligibleUsers(@Req() req: AuthenticatedRequest) {
    return this.transfersService.eligibleUsers(requireSiteId(req));
  }

  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateTransferDto) {
    return this.transfersService.create(requireSiteId(req), req.user.sub, dto);
  }

  @Get('incoming')
  listIncoming(@Req() req: AuthenticatedRequest) {
    return this.transfersService.listIncoming(requireSiteId(req));
  }

  @Get('outgoing')
  listOutgoing(@Req() req: AuthenticatedRequest) {
    return this.transfersService.listOutgoing(requireSiteId(req));
  }

  @Patch(':id/respond')
  respond(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: RespondTransferDto) {
    return this.transfersService.respond(requireSiteId(req), req.user.sub, id, dto);
  }
}
