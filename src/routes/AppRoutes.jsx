import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import Dashboard from '../Dashboard';
import ExecutiveDashboard from '../ExecutiveDashboard';
import PiketDashboard from '../PiketDashboard';
import PiketInput from '../PiketInput';
import RekapPiket from '../RekapPiket';
import PiketAbsensiGlobal from '../PiketAbsensiGlobal';
import HalamanAbsen from '../HalamanAbsen';
import RekapAbsen from '../RekapAbsen';
import AkumulasiSiswa from '../AkumulasiSiswa';
import ManajemenSiswa from '../ManajemenSiswa';
import ManajemenUser from '../ManajemenUser';
import PublicMonitoring from '../PublicMonitoring';
import ManajemenKelas from '../ManajemenKelas';
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
