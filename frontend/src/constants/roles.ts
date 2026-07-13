import type { Role } from '../api/client';

export const ROLES: Role[] = ['ADMIN', 'PLANNER', 'PRODUCTION_HEAD', 'SITE_LEAD', 'WORKER'];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Администратор',
  PLANNER: 'Планировщик',
  PRODUCTION_HEAD: 'Начальник производства',
  SITE_LEAD: 'Начальник участка',
  WORKER: 'Сотрудник',
};

export const SITE_BOUND_ROLES: Role[] = ['SITE_LEAD', 'WORKER'];
