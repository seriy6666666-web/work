import { Controller, Get, Param, Patch, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/jwt.strategy';
import { NotificationsService } from './notifications.service';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private notifications: NotificationsService) {}

  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return this.notifications.list(req.user.sub);
  }

  @Get('unread-count')
  unreadCount(@Req() req: AuthenticatedRequest) {
    return this.notifications.unreadCount(req.user.sub);
  }

  @Patch('read-all')
  markAllRead(@Req() req: AuthenticatedRequest) {
    return this.notifications.markAllRead(req.user.sub);
  }

  @Patch(':id/read')
  markRead(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.notifications.markRead(req.user.sub, id);
  }
}
