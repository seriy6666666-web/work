import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { IntroSplash } from './components/IntroSplash';
import { ToastProvider } from './components/ToastProvider';
import { ConfirmProvider } from './components/ConfirmProvider';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { SitesPage } from './pages/admin/SitesPage';
import { PlatformsPage } from './pages/admin/PlatformsPage';
import { UsersPage } from './pages/admin/UsersPage';
import { AuditLogPage } from './pages/admin/AuditLogPage';
import { FeedbackPage } from './pages/admin/FeedbackPage';
import { OrdersPage } from './pages/planner/OrdersPage';
import { OrderDetailPage } from './pages/planner/OrderDetailPage';
import { SkillsPage } from './pages/planner/SkillsPage';
import { ProductsPage } from './pages/planner/ProductsPage';
import { MaterialsPage } from './pages/planner/MaterialsPage';
import { ImportPage } from './pages/planner/ImportPage';
import { ImportUsersPage } from './pages/admin/ImportUsersPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { CompetencyMatrixPage } from './pages/site-lead/CompetencyMatrixPage';
import { DistributionPage } from './pages/site-lead/DistributionPage';
import { AbsencesPage } from './pages/site-lead/AbsencesPage';
import { TransfersPage } from './pages/site-lead/TransfersPage';
import { StatsPage } from './pages/site-lead/StatsPage';
import { EquipmentPage } from './pages/site-lead/EquipmentPage';
import { ShiftPlanningPage } from './pages/site-lead/ShiftPlanningPage';
import { AttendanceJournalPage } from './pages/site-lead/AttendanceJournalPage';
import { PlantSummaryPage } from './pages/production-head/PlantSummaryPage';
import { EquipmentOverviewPage } from './pages/production-head/EquipmentOverviewPage';
import { MaterialsOverviewPage } from './pages/production-head/MaterialsOverviewPage';
import { TrendsPage } from './pages/production-head/TrendsPage';
import { SiteDetailPage } from './pages/production-head/SiteDetailPage';
import { WarningsPage } from './pages/production-head/WarningsPage';
import { TasksPage } from './pages/worker/TasksPage';
import { TasksPage as ManagerTasksPage } from './pages/shared/TasksPage';
import { MyWorkPage } from './pages/shared/MyWorkPage';
import { HandoverPage } from './pages/shared/HandoverPage';
import { GoalsPage } from './pages/site-lead/GoalsPage';
import { ShiftLeadsPage } from './pages/production-head/ShiftLeadsPage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
        <ConfirmProvider>
        <IntroSplash>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/platforms"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <PlatformsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/sites"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <SitesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <UsersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/import"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <ImportUsersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/feedback"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <FeedbackPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/audit-log"
              element={
                <ProtectedRoute allowedRoles={['ADMIN']}>
                  <AuditLogPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/planner/orders"
              element={
                <ProtectedRoute allowedRoles={['PLANNER']}>
                  <OrdersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/planner/orders/:id"
              element={
                <ProtectedRoute allowedRoles={['PLANNER']}>
                  <OrderDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/planner/skills"
              element={
                <ProtectedRoute allowedRoles={['PLANNER']}>
                  <SkillsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/planner/products"
              element={
                <ProtectedRoute allowedRoles={['PLANNER']}>
                  <ProductsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/planner/materials"
              element={
                <ProtectedRoute allowedRoles={['PLANNER']}>
                  <MaterialsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/planner/import"
              element={
                <ProtectedRoute allowedRoles={['PLANNER']}>
                  <ImportPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/site-lead/competency"
              element={
                <ProtectedRoute allowedRoles={['SITE_LEAD']}>
                  <CompetencyMatrixPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/site-lead/distribution"
              element={
                <ProtectedRoute allowedRoles={['SITE_LEAD']}>
                  <DistributionPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/site-lead/absences"
              element={
                <ProtectedRoute allowedRoles={['SITE_LEAD']}>
                  <AbsencesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/site-lead/transfers"
              element={
                <ProtectedRoute allowedRoles={['SITE_LEAD']}>
                  <TransfersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/site-lead/shifts"
              element={
                <ProtectedRoute allowedRoles={['SITE_LEAD']}>
                  <ShiftPlanningPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/site-lead/journal"
              element={
                <ProtectedRoute allowedRoles={['SITE_LEAD']}>
                  <AttendanceJournalPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/site-lead/equipment"
              element={
                <ProtectedRoute allowedRoles={['SITE_LEAD']}>
                  <EquipmentPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/site-lead/stats"
              element={
                <ProtectedRoute allowedRoles={['SITE_LEAD']}>
                  <StatsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/production-head/summary"
              element={
                <ProtectedRoute allowedRoles={['PRODUCTION_HEAD']}>
                  <PlantSummaryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/production-head/sites/:siteId"
              element={
                <ProtectedRoute allowedRoles={['PRODUCTION_HEAD']}>
                  <SiteDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/production-head/equipment"
              element={
                <ProtectedRoute allowedRoles={['PRODUCTION_HEAD']}>
                  <EquipmentOverviewPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/production-head/materials"
              element={
                <ProtectedRoute allowedRoles={['PRODUCTION_HEAD']}>
                  <MaterialsOverviewPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/production-head/trends"
              element={
                <ProtectedRoute allowedRoles={['PRODUCTION_HEAD']}>
                  <TrendsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/production-head/warnings"
              element={
                <ProtectedRoute allowedRoles={['PRODUCTION_HEAD']}>
                  <WarningsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/worker/tasks"
              element={
                <ProtectedRoute allowedRoles={['WORKER']}>
                  <TasksPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/my-work"
              element={
                <ProtectedRoute allowedRoles={['SITE_LEAD', 'PRODUCTION_HEAD']}>
                  <MyWorkPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tasks"
              element={
                <ProtectedRoute allowedRoles={['SITE_LEAD', 'PRODUCTION_HEAD']}>
                  <ManagerTasksPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/handover"
              element={
                <ProtectedRoute allowedRoles={['SITE_LEAD', 'PRODUCTION_HEAD']}>
                  <HandoverPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/site-lead/goals"
              element={
                <ProtectedRoute allowedRoles={['SITE_LEAD']}>
                  <GoalsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/production-head/shift-leads"
              element={
                <ProtectedRoute allowedRoles={['PRODUCTION_HEAD']}>
                  <ShiftLeadsPage />
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            {/* Без этого любая опечатка в адресе давала пустой белый экран. */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </IntroSplash>
        </ConfirmProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
