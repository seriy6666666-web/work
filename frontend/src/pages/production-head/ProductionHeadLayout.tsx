import type { ReactNode } from 'react';
import { SidebarLayout, type SidebarTab } from '../../components/SidebarLayout';

const TABS: SidebarTab[] = [
  { path: '/production-head/summary', label: 'Сводка участков', icon: 'building' },
  { path: '/production-head/equipment', label: 'Оборудование', icon: 'wrench' },
  { path: '/production-head/materials', label: 'Материалы', icon: 'layers' },
  { path: '/production-head/trends', label: 'Тренды', icon: 'bar-chart' },
  { path: '/production-head/shift-leads', label: 'Старшие смен', icon: 'users' },
  { path: '/production-head/warnings', label: 'Предупреждения', icon: 'warning' },
  { path: '/handover', label: 'Пересменка', icon: 'swap' },
  { path: '/my-work', label: 'Моя работа', icon: 'check' },
  { path: '/tasks', label: 'Задачи', icon: 'checklist' },
];

export function ProductionHeadLayout({
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
      roleLabel="Начальник производства"
      tabs={TABS}
      title={title}
      breadcrumb={breadcrumb}
      headerExtra={headerExtra}
    >
      {children}
    </SidebarLayout>
  );
}
