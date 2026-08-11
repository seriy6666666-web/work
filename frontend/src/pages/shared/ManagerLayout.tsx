import type { ReactNode } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { SiteLeadLayout } from '../site-lead/SiteLeadLayout';
import { ProductionHeadLayout } from '../production-head/ProductionHeadLayout';

/**
 * Общие экраны руководителей (задачи, свои задания) должны открываться внутри
 * «родного» сайдбара роли — иначе человек теряет свою навигацию.
 */
export function ManagerLayout({
  title,
  breadcrumb,
  children,
}: {
  title: string;
  breadcrumb?: string;
  children: ReactNode;
}) {
  const { user } = useAuth();

  if (user?.role === 'PRODUCTION_HEAD') {
    return (
      <ProductionHeadLayout title={title} breadcrumb={breadcrumb}>
        {children}
      </ProductionHeadLayout>
    );
  }
  return (
    <SiteLeadLayout title={title} breadcrumb={breadcrumb}>
      {children}
    </SiteLeadLayout>
  );
}
