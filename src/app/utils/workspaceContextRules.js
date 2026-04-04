import { MAPEL_AUDIT_ROUTE, PEMBIASAAN_REPORT_ROUTE } from '../../shared/constants/routes.js';

export const getWorkspaceContext = (pathname = '') => {
  const isAuditRoute = pathname === MAPEL_AUDIT_ROUTE;
  const isPembiasaanReportRoute = pathname === PEMBIASAAN_REPORT_ROUTE;
  const isMapelWorkspace = pathname.startsWith('/mapel') && !isAuditRoute;
  const isPembiasaanWorkspace = pathname.startsWith('/pembiasaan') && !isPembiasaanReportRoute;

  return {
    isAuditRoute,
    isPembiasaanReportRoute,
    isMapelWorkspace,
    isPembiasaanWorkspace,
  };
};
