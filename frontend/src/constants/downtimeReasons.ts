import type { DowntimeReasonCode } from '../api/client';

export const DOWNTIME_REASON_CODES: DowntimeReasonCode[] = [
  'NO_MATERIAL',
  'EQUIPMENT_BREAKDOWN',
  'NO_ELECTRICITY',
  'HEALTH_ISSUE',
  'OTHER',
];

export const DOWNTIME_REASON_LABELS: Record<DowntimeReasonCode, string> = {
  NO_MATERIAL: 'Нет материала',
  EQUIPMENT_BREAKDOWN: 'Поломка оборудования',
  NO_ELECTRICITY: 'Нет электричества',
  HEALTH_ISSUE: 'Плохое самочувствие',
  OTHER: 'Другое',
};

export const DOWNTIME_REASON_ZONE: Record<DowntimeReasonCode, 'Производство' | 'Личная'> = {
  NO_MATERIAL: 'Производство',
  EQUIPMENT_BREAKDOWN: 'Производство',
  NO_ELECTRICITY: 'Производство',
  HEALTH_ISSUE: 'Личная',
  OTHER: 'Личная',
};
