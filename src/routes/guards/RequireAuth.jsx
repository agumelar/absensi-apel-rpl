import React from 'react';
import { hasValidSession } from '../../services/auth/sessionService';

const RequireAuth = ({
  isLoggedIn,
  currentPath,
  publicPath,
  publicElement,
  fallbackElement,
  children,
}) => {
  const sessionReady = isLoggedIn || hasValidSession();

  if (!sessionReady && currentPath === publicPath) {
    return publicElement;
  }

  if (!sessionReady) {
    return fallbackElement;
  }

  return children;
};

export default RequireAuth;
