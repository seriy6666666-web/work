import type { ReactNode } from 'react';
import { SidebarLayout, type SidebarTab } from '../../components/SidebarLayout';

const TABS: SidebarTab[] = [
  { path: '/site-lead/distribution', label: 'Распределение', icon: 'shuffle' },
  { path: '/site-lead/competency', label: 'Матрица компетенций', icon: 'checklist' },
  { path: '/site-lead/absences', label: 'Отсутствия', icon: 'calendar-x' },
  { path: '/site-lead/transfers', label: 'Переводы', icon: 'swap' },
  { path: '/site-lead/shifts', label: 'Планирование смен', icon: 'calendar' },
  { path: '/site-lead/equipment', label: 'Оборудование', icon: 'wrench' },
  { path: '/site-lead/stats', label: 'Статистика', icon: 'bar-chart' },
];

export function SiteLeadLayout({
  title,
  breadcrumb,
  headerExtra,
  children,
}: {
  title: string;
  breadcrumb?: string;
  headerExtra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <SidebarLayout
      roleLabel="Начальник участка"
      tabs={TABS}
      title={title}
      breadcrumb={breadcrumb}
      headerExtra={headerExtra}
    >
      {children}
    </SidebarLayout>
  );
}
