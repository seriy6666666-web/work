import {
  Body,
  Controller,
  Get,
  Header,
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
import { Role, type FeedbackStatus, type FeedbackType } from '../generated/prisma/enums';
import type { AuthenticatedRequest } from '../auth/jwt.strategy';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { UpdateFeedbackDto } from './dto/update-feedback.dto';
import { FeedbackService, type FeedbackFilters } from './feedback.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('feedback')
export class FeedbackController {
  constructor(private feedback: FeedbackService) {}

  /** Написать может кто угодно — в этом весь смысл. */
  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateFeedbackDto) {
    return this.feedback.create(req.user, dto);
  }

  @Get('mine')
  mine(@Req() req: AuthenticatedRequest) {
    return this.feedback.listMine(req.user.sub);
  }

  // Читает только администратор: иначе про начальника участка никто не напишет правду.
  @Roles(Role.ADMIN)
  @Get()
  list(@Query() query: Record<string, string | undefined>) {
    return this.feedback.list(toFilters(query));
  }

  @Roles(Role.ADMIN)
  @Get('summary')
  summary(@Query() query: Record<string, string | undefined>) {
    return this.feedback.summary(toFilters(query));
  }

  @Roles(Role.ADMIN)
  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="feedback.csv"')
  async export(@Query() query: Record<string, string | undefined>) {
    return this.feedback.toCsv(await this.feedback.list(toFilters(query)));
  }

  @Roles(Role.ADMIN)
  @Patch(':id')
  update(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: UpdateFeedbackDto) {
    return this.feedback.update(id, req.user.sub, dto);
  }
}

function toFilters(query: Record<string, string | undefined>): FeedbackFilters {
  return {
    type: query.type as FeedbackType | undefined,
    status: query.status as FeedbackStatus | undefined,
    siteId: query.siteId,
    from: query.from,
    to: query.to,
  };
}
