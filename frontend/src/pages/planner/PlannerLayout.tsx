import type { ReactNode } from 'react';
import { SidebarLayout, type SidebarTab } from '../../components/SidebarLayout';

const TABS: SidebarTab[] = [
  { path: '/planner/orders', label: 'Заказы', icon: 'box' },
  { path: '/planner/products', label: 'Продукты', icon: 'grid' },
  { path: '/planner/skills', label: 'Навыки', icon: 'star' },
];

export function PlannerLayout({
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
      roleLabel="Планирование"
      tabs={TABS}
      title={title}
      breadcrumb={breadcrumb}
      headerExtra={headerExtra}
    >
      {children}
    </SidebarLayout>
  );
}
