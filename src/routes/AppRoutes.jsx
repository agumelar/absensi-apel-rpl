import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import Dashboard from '../features/dashboard/pages/DashboardPage';
import ExecutiveDashboard from '../features/dashboard/pages/ExecutiveDashboardPage';
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
import RequireRole from './guards/RequireRole';
import { DASHBOARD_ROUTE } from '../shared/constants/routes';

const AppRoutes = ({
  isExec,
  isPiket,
  isAdmin,
  isWalas,
  userData,
  dashboardLink,
}) => {
  return (
    <Routes>
      <Route path="/monitoring" element={<PublicMonitoring />} />
      <Route
        path={DASHBOARD_ROUTE}
        element={isExec ? <ExecutiveDashboard user={userData} /> : <Dashboard user={userData} />}
      />
      <Route
        path="/piket-dashboard"
        element={
          <RequireRole allow={isPiket || isAdmin}>
            <PiketDashboard user={userData} />
          </RequireRole>
        }
      />
      <Route
        path="/piket-input"
        element={
          <RequireRole allow={isPiket || isAdmin}>
            <PiketInput user={userData} />
          </RequireRole>
        }
      />
      <Route
        path="/piket-absen-global"
        element={
          <RequireRole allow={isPiket || isAdmin}>
            <PiketAbsensiGlobal />
          </RequireRole>
        }
      />
      <Route
        path="/rekap-piket"
        element={
          <RequireRole allow={isPiket || isAdmin}>
            <RekapPiket />
          </RequireRole>
        }
      />
      <Route
        path="/absen"
        element={
          <RequireRole allow={isWalas || isAdmin}>
            <HalamanAbsen user={userData} />
          </RequireRole>
        }
      />
      <Route
        path="/rekap"
        element={
          <RequireRole allow={isWalas || isAdmin}>
            <RekapAbsen user={userData} />
          </RequireRole>
        }
      />
      <Route
        path="/akumulasi"
        element={
          <RequireRole allow={isWalas || isAdmin}>
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
      <Route path="/" element={<Navigate to={dashboardLink} />} />
    </Routes>
  );
};

export default AppRoutes;
