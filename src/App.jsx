import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './Login';
import PublicMonitoring from './PublicMonitoring';
import AppShell from './app/AppShell';
import AppRoutes from './routes/AppRoutes';
import RequireAuth from './routes/guards/RequireAuth';
import { PUBLIC_MONITORING_ROUTE } from './shared/constants/routes';
import usePwaInstallPrompt from './app/hooks/usePwaInstallPrompt';
import useUserRoleFlags from './app/hooks/useUserRoleFlags';

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userData, setUserData] = useState(null);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const { deferredPrompt, handleInstallClick } = usePwaInstallPrompt();

  const handleLoginSuccess = (data) => {
    setUserData(data);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUserData(null);
    setSidebarOpen(false);
  };

  const { userRole, isAdmin, isPiket, isExec, isWalas, dashboardLink } = useUserRoleFlags(userData);
  const currentPath = window.location.pathname;
  const publicMonitoringElement = (
    <Router>
      <Routes>
        <Route path={PUBLIC_MONITORING_ROUTE} element={<PublicMonitoring />} />
      </Routes>
    </Router>
  );

  return (
    <RequireAuth
      isLoggedIn={isLoggedIn}
      currentPath={currentPath}
      publicPath={PUBLIC_MONITORING_ROUTE}
      publicElement={publicMonitoringElement}
      fallbackElement={<Login onLogin={handleLoginSuccess} />}
    >
      <Router>
        <AppShell
          isSidebarOpen={isSidebarOpen}
          setSidebarOpen={setSidebarOpen}
          isPiket={isPiket}
          isExec={isExec}
          isWalas={isWalas}
          isAdmin={isAdmin}
          deferredPrompt={deferredPrompt}
          handleInstallClick={handleInstallClick}
          userData={userData}
          userRole={userRole}
          handleLogout={handleLogout}
        >
          <AppRoutes
            isExec={isExec}
            isPiket={isPiket}
            isAdmin={isAdmin}
            isWalas={isWalas}
            userData={userData}
            dashboardLink={dashboardLink}
          />
        </AppShell>
      </Router>
    </RequireAuth>
  );
};

export default App;
