import React from 'react';
import { Link } from 'react-router-dom';
import { DASHBOARD_ROUTE, MAPEL_DASHBOARD_ROUTE } from '../../../shared/constants/routes';

const PortalWorkspacePage = ({ canAccessMapel, apelWorkspaceRoute = DASHBOARD_ROUTE }) => {
  return (
    <section className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-4 py-8 md:px-8">
      <div className="w-full rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur md:p-8">
        <h1 className="text-2xl font-black text-gray-900 md:text-3xl">Pilih Workspace</h1>
        <p className="mt-2 text-gray-500">Pilih modul kerja yang ingin kamu buka sekarang.</p>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Link
            to={apelWorkspaceRoute}
            className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm transition hover:shadow-md"
          >
            <h2 className="text-lg font-extrabold text-blue-700">Manajemen Absen</h2>
            <p className="mt-1 text-sm text-gray-500">Walas/Kakom/Kesiswaan/Kurikulum</p>
          </Link>

          <Link
            to={canAccessMapel ? MAPEL_DASHBOARD_ROUTE : DASHBOARD_ROUTE}
            className="rounded-2xl border border-orange-100 bg-white p-5 shadow-sm transition hover:shadow-md"
          >
            <h2 className="text-lg font-extrabold text-orange-600">KBM</h2>
            <p className="mt-1 text-sm text-gray-500">
              {canAccessMapel
                ? 'Masuk ke flow KBM mapel, jadwal, dan sesi pembelajaran.'
                : 'Akses mapel belum aktif untuk akun ini.'}
            </p>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default PortalWorkspacePage;
