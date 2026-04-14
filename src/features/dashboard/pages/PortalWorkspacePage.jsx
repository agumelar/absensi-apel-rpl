import React from 'react';
import { Link } from 'react-router-dom';
import { DASHBOARD_ROUTE } from '../../../shared/constants/routes';
import { buildWorkspacePortalItems } from '../utils/workspacePortalRules';

const PortalWorkspacePage = ({
  canAccessMapel,
  canAccessPembiasaanWorkspace,
  canAccessApelWorkspace,
  apelWorkspaceRoute = DASHBOARD_ROUTE,
}) => {
  const workspaceItems = buildWorkspacePortalItems({
    canAccessApelWorkspace,
    canAccessMapel,
    canAccessPembiasaanWorkspace,
    apelWorkspaceRoute,
  });

  const gridClassName =
    workspaceItems.length === 1
      ? 'mt-6 grid grid-cols-1 gap-4 md:grid-cols-1'
      : workspaceItems.length === 2
      ? 'mt-6 grid grid-cols-1 gap-4 md:grid-cols-2'
      : 'mt-6 grid grid-cols-1 gap-4 md:grid-cols-3';

  return (
    <section className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-4 py-8 md:px-8">
      <div className="w-full rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur md:p-8">
        <h1 className="text-2xl font-black text-gray-900 md:text-3xl">Pilih Workspace</h1>
        <p className="mt-2 text-gray-500">Pilih modul kerja yang ingin kamu buka sekarang.</p>

        <div className={gridClassName}>
          {workspaceItems.map((item) => (
            <Link key={item.key} to={item.to} className={`rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md ${item.cardClass}`}>
              <h2 className={`text-lg font-extrabold ${item.titleClass}`}>{item.title}</h2>
              <p className="mt-1 text-sm text-gray-500">{item.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PortalWorkspacePage;
