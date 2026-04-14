import {
  APP_SWITCHER_ROUTE,
  DASHBOARD_ROUTE,
  MAPEL_DASHBOARD_ROUTE,
  PEMBIASAAN_DASHBOARD_ROUTE,
  PIKET_DASHBOARD_ROUTE,
  TEACHER_PERFORMANCE_ROUTE,
} from '../../shared/constants/routes.js';
import {
  isExecutiveRole,
  isMapelAuditRole,
  isMapelAccessRole,
  isPembiasaanParticipantRole,
  normalizeBooleanFlag,
  normalizeRole,
} from '../../shared/constants/roles.js';

const useUserRoleFlags = (userData) => {
  const userRole = normalizeRole(userData?.role);
  const isGuruRole = userRole === 'guru' || userRole === 'guru_mapel';
  const isAdmin = userRole === 'admin';
  const isKepsek = userRole === 'kepsek';
  const isPiket = userRole === 'piket';
  const isExec = isExecutiveRole(userRole);
  const isWalas = userRole === 'walas' || userRole === 'walikelas';
  const isTu = userRole === 'tu';
  const isKesiswaan = userRole === 'kesiswaan';
  const isKurikulum = userRole === 'kurikulum';
  const isGuruMapel = normalizeBooleanFlag(userData?.is_guru_mapel);
  const canAccessMapel = isMapelAccessRole(userRole) || isGuruMapel || isGuruRole;
  const canAccessMapelAudit = isMapelAuditRole(userRole);
  const canAccessPembiasaanWorkspace = isPembiasaanParticipantRole(userRole);
  const canViewPembiasaanReport = isExec;
  const canAccessApelWorkspace = isAdmin || isPiket || isExec || isWalas;
  const workspaceAccessCount = [canAccessApelWorkspace, canAccessMapel, canAccessPembiasaanWorkspace].filter(Boolean).length;
  const hasMultiWorkspace = !isKepsek && !isAdmin && !isPiket && workspaceAccessCount >= 2;
  const canViewExecutiveControl = isExec && !isKurikulum;
  const canViewTeacherPerformance = isExec && !isKesiswaan;
  const singleWorkspaceRoute = isTu
    ? PEMBIASAAN_DASHBOARD_ROUTE
    : isKepsek
    ? DASHBOARD_ROUTE
    : isPiket
    ? PIKET_DASHBOARD_ROUTE
    : isKurikulum
      ? TEACHER_PERFORMANCE_ROUTE
      : canAccessPembiasaanWorkspace && !canAccessMapel && !canAccessApelWorkspace
        ? PEMBIASAAN_DASHBOARD_ROUTE
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
    isTu,
    isGuruMapel,
    canAccessMapel,
    canAccessMapelAudit,
    canAccessPembiasaanWorkspace,
    canViewPembiasaanReport,
    canViewExecutiveControl,
    canViewTeacherPerformance,
    canAccessApelWorkspace,
    hasMultiWorkspace,
    singleWorkspaceRoute,
    dashboardLink,
  };
};

export default useUserRoleFlags;
