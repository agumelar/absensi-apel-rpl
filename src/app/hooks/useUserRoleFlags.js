import { DASHBOARD_ROUTE, PIKET_DASHBOARD_ROUTE } from '../../shared/constants/routes';
import { isExecutiveRole, normalizeRole } from '../../shared/constants/roles';

const useUserRoleFlags = (userData) => {
  const userRole = normalizeRole(userData?.role);
  const isAdmin = userRole === 'admin';
  const isPiket = userRole === 'piket';
  const isExec = isExecutiveRole(userRole);
  const isWalas = userRole === 'walas' || userRole === 'walikelas';
  const dashboardLink = isPiket ? PIKET_DASHBOARD_ROUTE : DASHBOARD_ROUTE;

  return {
    userRole,
    isAdmin,
    isPiket,
    isExec,
    isWalas,
    dashboardLink,
  };
};

export default useUserRoleFlags;
