import type { ReactNode } from 'react';
import { SidebarLayout, type SidebarTab } from '../../components/SidebarLayout';

const TABS: SidebarTab[] = [
  { path: '/admin/platforms', label: 'Площадки', icon: 'building' },
  { path: '/admin/sites', label: 'Участки', icon: 'grid' },
  { path: '/admin/users', label: 'Пользователи', icon: 'users' },
  { path: '/admin/audit-log', label: 'Журнал действий', icon: 'list' },
];

export function AdminLayout({
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
      roleLabel="Администрирование"
      tabs={TABS}
      title={title}
      breadcrumb={breadcrumb}
      headerExtra={headerExtra}
    >
      {children}
    </SidebarLayout>
  );
}
