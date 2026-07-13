import type { OrderStatus } from '../api/client';

export const ORDER_STATUSES: OrderStatus[] = ['CREATED', 'IN_PROGRESS', 'DONE', 'SHIPPED'];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  CREATED: 'Создан',
  IN_PROGRESS: 'В работе',
  DONE: 'Выполнен',
  SHIPPED: 'Отгружен',
};
