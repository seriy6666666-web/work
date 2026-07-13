import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({ cors: { origin: true } })
export class EventsGateway {
  @WebSocketServer()
  server!: Server;

  /**
   * Notify connected clients that a site's distribution board changed
   * (assignment added/removed, task completed, worker checked in, ...).
   * Frontend clients filter by their own siteId.
   */
  emitDistributionChanged(...siteIds: (string | null | undefined)[]) {
    const unique = [...new Set(siteIds.filter((s): s is string => !!s))];
    for (const siteId of unique) {
      this.server?.emit('distribution:changed', { siteId });
    }
  }
}
