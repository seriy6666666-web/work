import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { Role } from '../generated/prisma/enums';
import type { AuthenticatedRequest } from '../auth/jwt.strategy';
import { CreateTaskDto } from './dto/create-task.dto';
import { TasksService } from './tasks.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SITE_LEAD, Role.PRODUCTION_HEAD)
@Controller('tasks')
export class TasksController {
  constructor(private tasks: TasksService) {}

  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return this.tasks.list(req.user.sub);
  }

  @Get('assignable')
  assignable() {
    return this.tasks.assignableUsers();
  }

  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateTaskDto) {
    return this.tasks.create(req.user.sub, dto);
  }

  @Patch(':id/status')
  setStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body('done') done: boolean,
  ) {
    return this.tasks.setStatus(req.user.sub, id, done);
  }

  @Delete(':id')
  remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.tasks.remove(req.user.sub, id);
  }
}
