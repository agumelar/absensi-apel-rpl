import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import Dashboard from '../features/dashboard/pages/DashboardPage';
import ExecutiveDashboard from '../features/dashboard/pages/ExecutiveDashboardPage';
import PortalWorkspacePage from '../features/dashboard/pages/PortalWorkspacePage';
import TeacherPerformancePage from '../features/dashboard/pages/TeacherPerformancePage';
import PiketDashboard from '../features/piket/pages/PiketDashboardPage';
import PiketInput from '../features/piket/pages/PiketInputPage';
import RekapPiket from '../features/piket/pages/RekapPiketPage';
import PiketAbsensiGlobal from '../features/piket/pages/PiketAbsensiGlobalPage';
import HalamanAbsen from '../features/absensi/pages/HalamanAbsenPage';
import RekapAbsen from '../features/absensi/pages/RekapAbsenPage';
import AkumulasiSiswa from '../features/absensi/pages/AkumulasiSiswaPage';
import ManajemenSiswa from '../features/admin/pages/ManajemenSiswaPage';
import ManajemenUser from '../features/admin/pages/ManajemenUserPage';
import PublicMonitoring from '../features/monitoring/pages/PublicMonitoringPage';
import ManajemenKelas from '../features/admin/pages/ManajemenKelasPage';
import ManajemenMapel from '../features/admin/pages/ManajemenMapelPage';
import MapelHomePage from '../features/mapel/pages/MapelHomePage';
import MapelSchedulePage from '../features/mapel/pages/MapelSchedulePage';
import MapelSessionPage from '../features/mapel/pages/MapelSessionPage';
import MapelScorePage from '../features/mapel/pages/MapelScorePage';
import MapelSessionHistoryPage from '../features/mapel/pages/MapelSessionHistoryPage';
import MapelAuditTrailPage from '../features/mapel/pages/MapelAuditTrailPage';
import RequireRole from './guards/RequireRole';
import {
  APP_SWITCHER_ROUTE,
  DASHBOARD_ROUTE,
  MAPEL_AUDIT_ROUTE,
  MAPEL_DASHBOARD_ROUTE,
  MAPEL_HISTORY_ROUTE,
  MAPEL_SCHEDULE_ROUTE,
  MAPEL_SCORE_ROUTE,
  MAPEL_SESSION_ROUTE,
  TEACHER_PERFORMANCE_ROUTE,
} from '../shared/constants/routes';

const AppRoutes = ({
  isPiket,
  isAdmin,
  isWalas,
  canAccessMapel,
  canAccessMapelAudit,
  canViewExecutiveControl,
  canViewTeacherPerformance,
  canAccessApelWorkspace,
  hasMultiWorkspace,
  singleWorkspaceRoute,
  userData,
  dashboardLink,
}) => {
  return (
    <Routes>
      <Route path="/monitoring" element={<PublicMonitoring />} />
      <Route
        path={DASHBOARD_ROUTE}
        element={
          !canAccessApelWorkspace && canAccessMapel ? (
            <Navigate to={MAPEL_DASHBOARD_ROUTE} replace />
          ) : canViewExecutiveControl ? (
            <ExecutiveDashboard user={userData} />
          ) : canViewTeacherPerformance ? (
            <Navigate to={TEACHER_PERFORMANCE_ROUTE} replace />
          ) : (
            <Dashboard user={userData} />
          )
        }
      />
      <Route
        path={APP_SWITCHER_ROUTE}
        element={
          <RequireRole allow={hasMultiWorkspace} redirectTo={singleWorkspaceRoute}>
            <PortalWorkspacePage canAccessMapel={canAccessMapel} apelWorkspaceRoute={singleWorkspaceRoute} />
          </RequireRole>
        }
      />
      <Route
        path={TEACHER_PERFORMANCE_ROUTE}
        element={
          <RequireRole allow={canViewTeacherPerformance}>
            <TeacherPerformancePage user={userData} />
          </RequireRole>
        }
      />
      <Route
        path={MAPEL_DASHBOARD_ROUTE}
        element={
          <RequireRole allow={canAccessMapel}>
            <MapelHomePage user={userData} />
          </RequireRole>
        }
      />
      <Route
        path={MAPEL_SCHEDULE_ROUTE}
        element={
          <RequireRole allow={canAccessMapel}>
            <MapelSchedulePage user={userData} />
          </RequireRole>
        }
      />
      <Route
        path={MAPEL_SESSION_ROUTE}
        element={
          <RequireRole allow={canAccessMapel}>
            <MapelSessionPage user={userData} />
          </RequireRole>
        }
      />
      <Route
        path={MAPEL_SCORE_ROUTE}
        element={
          <RequireRole allow={canAccessMapel}>
            <MapelScorePage user={userData} />
          </RequireRole>
        }
      />
      <Route
        path={MAPEL_HISTORY_ROUTE}
        element={
          <RequireRole allow={canAccessMapel}>
            <MapelSessionHistoryPage user={userData} />
          </RequireRole>
        }
      />
      <Route
        path={MAPEL_AUDIT_ROUTE}
        element={
          <RequireRole allow={canAccessMapelAudit}>
            <MapelAuditTrailPage user={userData} />
          </RequireRole>
        }
      />
      <Route
        path="/piket-dashboard"
        element={
          <RequireRole allow={isPiket}>
            <PiketDashboard user={userData} />
          </RequireRole>
        }
      />
      <Route
        path="/piket-input"
        element={
          <RequireRole allow={isPiket}>
            <PiketInput user={userData} />
          </RequireRole>
        }
      />
      <Route
        path="/piket-absen-global"
        element={
          <RequireRole allow={isPiket}>
            <PiketAbsensiGlobal />
          </RequireRole>
        }
      />
      <Route
        path="/rekap-piket"
        element={
          <RequireRole allow={isPiket}>
            <RekapPiket />
          </RequireRole>
        }
      />
      <Route
        path="/absen"
        element={
          <RequireRole allow={isWalas}>
            <HalamanAbsen user={userData} />
          </RequireRole>
        }
      />
      <Route
        path="/rekap"
        element={
          <RequireRole allow={isWalas}>
            <RekapAbsen user={userData} />
          </RequireRole>
        }
      />
      <Route
        path="/akumulasi"
        element={
          <RequireRole allow={isWalas}>
            <AkumulasiSiswa user={userData} />
          </RequireRole>
        }
      />
      <Route
        path="/manajemen-siswa"
        element={
          <RequireRole allow={isAdmin}>
            <ManajemenSiswa />
          </RequireRole>
        }
      />
      <Route
        path="/manajemen-user"
        element={
          <RequireRole allow={isAdmin}>
            <ManajemenUser />
          </RequireRole>
        }
      />
      <Route
        path="/manajemen-kelas"
        element={
          <RequireRole allow={isAdmin}>
            <ManajemenKelas />
          </RequireRole>
        }
      />
      <Route
        path="/manajemen-mapel"
        element={
          <RequireRole allow={isAdmin}>
            <ManajemenMapel />
          </RequireRole>
        }
      />
      <Route path="/" element={<Navigate to={dashboardLink} />} />
    </Routes>
  );
};

export default AppRoutes;
