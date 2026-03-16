import React from 'react';

const RequireAuth = ({
  isLoggedIn,
  currentPath,
  publicPath,
  publicElement,
  fallbackElement,
  children,
}) => {
  if (!isLoggedIn && currentPath === publicPath) {
    return publicElement;
  }

  if (!isLoggedIn) {
    return fallbackElement;
  }

  return children;
};

export default RequireAuth;
