import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Login from './features/auth/pages/LoginPage';
import PublicMonitoring from './features/monitoring/pages/PublicMonitoringPage';
import AppShell from './app/AppShell';
import AppRoutes from './routes/AppRoutes';
import RequireAuth from './routes/guards/RequireAuth';
import { APP_SWITCHER_ROUTE, PUBLIC_MONITORING_ROUTE } from './shared/constants/routes';
import usePwaInstallPrompt from './app/hooks/usePwaInstallPrompt';
import useUserRoleFlags from './app/hooks/useUserRoleFlags';
import useThemeMode from './app/hooks/useThemeMode';
import { clearSession, hasValidSession, persistSession, readSession } from './services/auth/sessionService';

const AuthenticatedLayout = ({
  isSidebarOpen,
  setSidebarOpen,
  isPiket,
  isExec,
  isWalas,
  isAdmin,
  canAccessMapel,
  canAccessMapelAudit,
  canAccessApelWorkspace,
  hasMultiWorkspace,
  singleWorkspaceRoute,
  userData,
  userRole,
  dashboardLink,
  deferredPrompt,
  handleInstallClick,
  isDark,
  toggleTheme,
  handleLogout,
}) => {
  const location = useLocation();
  const isPortalRoute = location.pathname === APP_SWITCHER_ROUTE;

  const appRoutesElement = (
    <AppRoutes
      isExec={isExec}
      isPiket={isPiket}
      isAdmin={isAdmin}
      isWalas={isWalas}
      canAccessMapel={canAccessMapel}
      canAccessMapelAudit={canAccessMapelAudit}
      canAccessApelWorkspace={canAccessApelWorkspace}
      hasMultiWorkspace={hasMultiWorkspace}
      singleWorkspaceRoute={singleWorkspaceRoute}
      userData={userData}
      dashboardLink={dashboardLink}
    />
  );

  if (isPortalRoute) {
    return <div className="app-texture min-h-screen">{appRoutesElement}</div>;
  }

  return (
    <AppShell
      isSidebarOpen={isSidebarOpen}
      setSidebarOpen={setSidebarOpen}
      isPiket={isPiket}
      isExec={isExec}
      isWalas={isWalas}
      isAdmin={isAdmin}
      canAccessMapel={canAccessMapel}
      canAccessMapelAudit={canAccessMapelAudit}
      hasMultiWorkspace={hasMultiWorkspace}
      deferredPrompt={deferredPrompt}
      handleInstallClick={handleInstallClick}
      userData={userData}
      userRole={userRole}
      isDark={isDark}
      toggleTheme={toggleTheme}
      handleLogout={handleLogout}
    >
      {appRoutesElement}
    </AppShell>
  );
};

const App = () => {
  const [userData, setUserData] = useState(() => readSession());
  const [isLoggedIn, setIsLoggedIn] = useState(() => hasValidSession());
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const { deferredPrompt, handleInstallClick } = usePwaInstallPrompt();
  const { isDark, toggleTheme } = useThemeMode();

  const handleLoginSuccess = (data) => {
    const sessionPayload = persistSession(data);
    setUserData(sessionPayload);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    clearSession();
    setIsLoggedIn(false);
    setUserData(null);
    setSidebarOpen(false);
  };

  const {
    userRole,
    isAdmin,
    isPiket,
    isExec,
    isWalas,
    canAccessMapel,
    canAccessMapelAudit,
    canAccessApelWorkspace,
    hasMultiWorkspace,
    singleWorkspaceRoute,
    dashboardLink,
  } = useUserRoleFlags(userData);
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
        <AuthenticatedLayout
          isSidebarOpen={isSidebarOpen}
          setSidebarOpen={setSidebarOpen}
          isPiket={isPiket}
          isExec={isExec}
          isWalas={isWalas}
          isAdmin={isAdmin}
          canAccessMapel={canAccessMapel}
          canAccessMapelAudit={canAccessMapelAudit}
          canAccessApelWorkspace={canAccessApelWorkspace}
          hasMultiWorkspace={hasMultiWorkspace}
          singleWorkspaceRoute={singleWorkspaceRoute}
          dashboardLink={dashboardLink}
          deferredPrompt={deferredPrompt}
          handleInstallClick={handleInstallClick}
          userData={userData}
          userRole={userRole}
          isDark={isDark}
          toggleTheme={toggleTheme}
          handleLogout={handleLogout}
        />
      </Router>
    </RequireAuth>
  );
};

export default App;
