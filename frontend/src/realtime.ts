import { useEffect, useRef, useState } from 'react';
import { io, type ManagerOptions, type Socket, type SocketOptions } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/**
 * Куда подключать socket.io.
 *
 * Когда API отдаётся с того же адреса через прокси, VITE_API_URL относительный
 * («/api»). Передать такую строку в io() нельзя: socket.io трактует строку,
 * начинающуюся со слеша, как имя пространства имён, а не как адрес — соединение
 * молча уходило бы не туда, и доска распределения перестала бы обновляться.
 * В этом случае подключаемся к текущему источнику, а прокси разбирается сам.
 */
const WS_URL = API_URL.startsWith('/') ? window.location.origin : API_URL;

/**
 * Настройки соединения — общие для всех подписок.
 *
 * Транспорты раньше были жёстко заданы одним websocket. На этом стенде так и
 * работает, но заводская сеть — не стенд: часть точек доступа и прокси websocket
 * режет. Тогда живое обновление не поднималось бы вообще и молча: доска у
 * начальника участка показывала бы данные на момент открытия страницы и выглядела
 * при этом совершенно нормально. Оставляем websocket первым, но с откатом на
 * обычные HTTP-запросы — они проходят везде, где проходит само приложение.
 */
const SOCKET_OPTIONS: Partial<ManagerOptions & SocketOptions> = {
  transports: ['websocket', 'polling'],
  // Переподключение включено по умолчанию, но срок между попытками задаём сами:
  // на смене важнее вернуться быстро, чем поберечь сеть.
  reconnectionDelay: 500,
  reconnectionDelayMax: 5000,
};

/**
 * Подписка на события с отслеживанием состояния связи.
 *
 * Возвращаемый `connected` нужен экранам, чтобы честно сказать «данные могли
 * устареть». Молча показывать снимок часовой давности хуже, чем признаться.
 */
function useSocketSubscription<T>(
  enabled: boolean,
  event: string,
  handler: (payload: T) => void,
  deps: unknown[],
): { connected: boolean } {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setConnected(false);
      return;
    }
    const socket: Socket = io(WS_URL, SOCKET_OPTIONS);
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onEvent = (payload: T) => handlerRef.current(payload);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on(event, onEvent);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off(event, onEvent);
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { connected };
}

/**
 * Подписка на изменения доски распределения по участку. `onChange` вызывается с
 * задержкой: когда смена массово отмечает выработку, события идут пачкой, и
 * перезапрашивать доску на каждое — значит держать её в постоянной перерисовке.
 */
export function useDistributionUpdates(
  siteId: string | null | undefined,
  onChange: () => void,
): { connected: boolean } {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return useSocketSubscription<{ siteId: string }>(
    Boolean(siteId),
    'distribution:changed',
    (payload) => {
      if (payload.siteId !== siteId) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => onChangeRef.current(), 400);
    },
    [siteId],
  );
}

/** Подписка на новые уведомления текущего пользователя. */
export function useNotificationUpdates(
  userId: string | null | undefined,
  onNew: () => void,
): { connected: boolean } {
  const onNewRef = useRef(onNew);
  onNewRef.current = onNew;

  return useSocketSubscription<{ userId: string }>(
    Boolean(userId),
    'notification:new',
    (payload) => {
      if (payload.userId === userId) onNewRef.current();
    },
    [userId],
  );
}
