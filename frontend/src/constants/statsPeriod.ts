import type { StatsPeriod } from '../api/client';

export const STATS_PERIODS: StatsPeriod[] = ['shift', 'week', 'month'];

export const STATS_PERIOD_LABELS: Record<StatsPeriod, string> = {
  shift: 'Смена',
  week: 'Неделя',
  month: 'Месяц',
};
