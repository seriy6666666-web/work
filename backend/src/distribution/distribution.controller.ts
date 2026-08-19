import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
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
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { ConfirmReasonDto } from './dto/confirm-reason.dto';
import { CarryOverDto } from './dto/carry-over.dto';
import { DistributionService } from './distribution.service';
import { EventsGateway } from '../events/events.gateway';

function requireSiteId(req: AuthenticatedRequest): string {
  if (!req.user.siteId) {
    throw new ForbiddenException('У вас не указан участок');
  }
  return req.user.siteId;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SITE_LEAD)
@Controller()
export class DistributionController {
  constructor(
    private distributionService: DistributionService,
    private events: EventsGateway,
  ) {}

  @Get('distribution/operations')
  listOperations(@Req() req: AuthenticatedRequest, @Query('date') date?: string) {
    // req.user.sub — чтобы ограничить выборку адресом начальника участка, если он указан.
    // date — день доски: начальник участка расставляет людей и на завтра.
    return this.distributionService.listOperations(requireSiteId(req), req.user.sub, date);
  }

  @Get('distribution/summary')
  getSummary(@Req() req: AuthenticatedRequest) {
    return this.distributionService.getSummary(requireSiteId(req), req.user.sub);
  }

  @Post('assignments')
  async createAssignment(@Req() req: AuthenticatedRequest, @Body() dto: CreateAssignmentDto) {
    const siteId = requireSiteId(req);
    const result = await this.distributionService.createAssignment(siteId, req.user.sub, dto);
    this.events.emitDistributionChanged(siteId);
    return result;
  }

  @Patch('assignments/:id')
  async updateAssignment(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateAssignmentDto,
  ) {
    const siteId = requireSiteId(req);
    const result = await this.distributionService.updateAssignment(siteId, id, dto);
    this.events.emitDistributionChanged(siteId);
    return result;
  }

  @Delete('assignments/:id')
  async removeAssignment(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const siteId = requireSiteId(req);
    const result = await this.distributionService.removeAssignment(siteId, id);
    this.events.emitDistributionChanged(siteId);
    return result;
  }

  /** Перенести остаток задания на другой день или на другого человека. */
  @Post('assignments/:id/carry-over')
  async carryOver(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: CarryOverDto,
  ) {
    const siteId = requireSiteId(req);
    const result = await this.distributionService.carryOver(siteId, id, dto);
    this.events.emitDistributionChanged(siteId);
    return result;
  }

  @Patch('completion-records/:id/confirm')
  async confirmReason(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: ConfirmReasonDto,
  ) {
    const siteId = requireSiteId(req);
    const result = await this.distributionService.confirmReason(siteId, id, dto);
    this.events.emitDistributionChanged(siteId);
    return result;
  }
}
