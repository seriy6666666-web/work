import type { AbsenceType } from '../api/client';

export const ABSENCE_TYPES: AbsenceType[] = ['SICK_LEAVE', 'VACATION', 'UNPAID_LEAVE'];

export const ABSENCE_TYPE_LABELS: Record<AbsenceType, string> = {
  SICK_LEAVE: 'Больничный',
  VACATION: 'Отпуск',
  UNPAID_LEAVE: 'Отгул за свой счёт',
};
