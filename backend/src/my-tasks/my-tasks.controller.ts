import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { Role } from '../generated/prisma/enums';
import type { AuthenticatedRequest } from '../auth/jwt.strategy';
import { SubmitCompletionDto } from './dto/submit-completion.dto';
import { MyTasksService } from './my-tasks.service';
import { EventsGateway } from '../events/events.gateway';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.WORKER)
@Controller('my-tasks')
export class MyTasksController {
  constructor(
    private myTasksService: MyTasksService,
    private events: EventsGateway,
  ) {}

  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return this.myTasksService.list(req.user.sub);
  }

  @Post(':assignmentId/completion')
  async submitCompletion(
    @Req() req: AuthenticatedRequest,
    @Param('assignmentId') assignmentId: string,
    @Body() dto: SubmitCompletionDto,
  ) {
    const result = await this.myTasksService.submitCompletion(req.user.sub, assignmentId, dto);
    this.events.emitDistributionChanged(req.user.siteId);
    return result;
  }
}
