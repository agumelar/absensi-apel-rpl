import React from 'react';
import { Navigate } from 'react-router-dom';

const RequireRole = ({ allow, children, redirectTo = '/dashboard' }) => {
  if (!allow) {
    return <Navigate to={redirectTo} />;
  }

  return children;
};

export default RequireRole;
