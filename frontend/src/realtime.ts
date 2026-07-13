import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/**
 * Subscribes to real-time distribution-board changes for a given site.
 * Calls `onChange` (debounced) whenever the server emits an update for
 * this site — e.g. a worker marks a task done, or another action changes
 * the board.
 */
export function useDistributionUpdates(siteId: string | null | undefined, onChange: () => void) {
  const callbackRef = useRef(onChange);
  callbackRef.current = onChange;

  useEffect(() => {
    if (!siteId) return;
    const socket: Socket = io(API_URL, { transports: ['websocket'] });

    let timer: ReturnType<typeof setTimeout> | null = null;
    const handler = (payload: { siteId: string }) => {
      if (payload.siteId !== siteId) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => callbackRef.current(), 400);
    };

    socket.on('distribution:changed', handler);
    return () => {
      if (timer) clearTimeout(timer);
      socket.off('distribution:changed', handler);
      socket.disconnect();
    };
  }, [siteId]);
}

/**
 * Subscribes to new-notification events for the current user and calls
 * `onNew` (which typically refetches the notification list + unread count).
 */
export function useNotificationUpdates(userId: string | null | undefined, onNew: () => void) {
  const callbackRef = useRef(onNew);
  callbackRef.current = onNew;

  useEffect(() => {
    if (!userId) return;
    const socket: Socket = io(API_URL, { transports: ['websocket'] });

    const handler = (payload: { userId: string }) => {
      if (payload.userId === userId) callbackRef.current();
    };

    socket.on('notification:new', handler);
    return () => {
      socket.off('notification:new', handler);
      socket.disconnect();
    };
  }, [userId]);
}
