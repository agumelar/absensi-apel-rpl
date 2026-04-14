import { DASHBOARD_ROUTE, MAPEL_DASHBOARD_ROUTE, PEMBIASAAN_DASHBOARD_ROUTE } from '../../../shared/constants/routes.js';

export const buildWorkspacePortalItems = ({
  canAccessApelWorkspace,
  canAccessMapel,
  canAccessPembiasaanWorkspace,
  apelWorkspaceRoute = DASHBOARD_ROUTE,
}) => {
  const items = [];

  if (canAccessApelWorkspace) {
    items.push({
      key: 'apel',
      to: apelWorkspaceRoute,
      title: 'Manajemen Absen',
      description: 'Walas/Kakom/Kesiswaan/Kurikulum',
      cardClass: 'border-blue-100',
      titleClass: 'text-blue-700',
    });
  }

  if (canAccessMapel) {
    items.push({
      key: 'mapel',
      to: MAPEL_DASHBOARD_ROUTE,
      title: 'KBM',
      description: 'Masuk ke flow KBM mapel, jadwal, dan sesi pembelajaran.',
      cardClass: 'border-orange-100',
      titleClass: 'text-orange-600',
    });
  }

  if (canAccessPembiasaanWorkspace) {
    items.push({
      key: 'pembiasaan',
      to: PEMBIASAAN_DASHBOARD_ROUTE,
      title: 'Pembiasaan',
      description: 'Dashboard, Sapa Pagi, dan Kegiatan Pembiasaan Harian.',
      cardClass: 'border-emerald-100',
      titleClass: 'text-emerald-600',
    });
  }

  return items;
};
