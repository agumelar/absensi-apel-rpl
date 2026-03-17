import {
  APP_SWITCHER_ROUTE,
  DASHBOARD_ROUTE,
  MAPEL_DASHBOARD_ROUTE,
  PIKET_DASHBOARD_ROUTE,
} from '../../shared/constants/routes';
import {
  isExecutiveRole,
  isMapelAuditRole,
  isMapelAccessRole,
  normalizeBooleanFlag,
  normalizeRole,
} from '../../shared/constants/roles';

const useUserRoleFlags = (userData) => {
  const userRole = normalizeRole(userData?.role);
  const isGuruRole = userRole === 'guru' || userRole === 'guru_mapel';
  const isAdmin = userRole === 'admin';
  const isPiket = userRole === 'piket';
  const isExec = isExecutiveRole(userRole);
  const isWalas = userRole === 'walas' || userRole === 'walikelas';
  const isGuruMapel = normalizeBooleanFlag(userData?.is_guru_mapel);
  const canAccessMapel = isMapelAccessRole(userRole) || isGuruMapel || isGuruRole;
  const canAccessMapelAudit = isMapelAuditRole(userRole);
  const canAccessApelWorkspace = isAdmin || isPiket || isExec || isWalas;
  const hasMultiWorkspace = canAccessApelWorkspace && canAccessMapel;
  const singleWorkspaceRoute = isPiket
    ? PIKET_DASHBOARD_ROUTE
    : canAccessMapel && !canAccessApelWorkspace
      ? MAPEL_DASHBOARD_ROUTE
      : DASHBOARD_ROUTE;
  const dashboardLink = hasMultiWorkspace ? APP_SWITCHER_ROUTE : singleWorkspaceRoute;

  return {
    userRole,
    isAdmin,
    isPiket,
    isExec,
    isWalas,
    isGuruMapel,
    canAccessMapel,
    canAccessMapelAudit,
    canAccessApelWorkspace,
    hasMultiWorkspace,
    singleWorkspaceRoute,
    dashboardLink,
  };
};

export default useUserRoleFlags;
