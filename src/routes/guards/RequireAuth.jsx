import React from 'react';
import { hasValidSession } from '../../services/auth/sessionService';

const RequireAuth = ({
  isLoggedIn,
  currentPath,
  publicPath,
  publicElement,
  demoBasePath,
  demoElement,
  fallbackElement,
  children,
}) => {
  const sessionReady = isLoggedIn || hasValidSession();

  if (!sessionReady && currentPath === publicPath) {
    return publicElement;
  }

  // Izinkan path /demo dan /demo/:role tanpa harus login terlebih dahulu
  if (!sessionReady && demoBasePath && currentPath.startsWith(demoBasePath)) {
    return demoElement;
  }

  if (!sessionReady) {
    return fallbackElement;
  }

  return children;
};

export default RequireAuth;
