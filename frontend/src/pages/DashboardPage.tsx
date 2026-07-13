import { Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import type { CurrentUser } from '../api/client';

const ROLE_HOME: Record<CurrentUser['role'], string> = {
  ADMIN: '/admin/sites',
  PLANNER: '/planner/orders',
  SITE_LEAD: '/site-lead/distribution',
  PRODUCTION_HEAD: '/production-head/summary',
  WORKER: '/worker/tasks',
};

export function DashboardPage() {
  const { user } = useAuth();

  if (!user) return null;

  return <Navigate to={ROLE_HOME[user.role]} replace />;
}
