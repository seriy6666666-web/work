import { IsIn, IsOptional } from 'class-validator';

export type StatsPeriod = 'shift' | 'week' | 'month';

export class StatsPeriodDto {
  @IsOptional()
  @IsIn(['shift', 'week', 'month'])
  period?: StatsPeriod;
}

export function periodStart(period: StatsPeriod = 'shift'): Date {
  const now = new Date();
  if (period === 'shift') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return start;
  }
  const days = period === 'week' ? 7 : 30;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}
