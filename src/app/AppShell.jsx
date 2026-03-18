import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  ClipboardCheck,
  Users,
  LogOut,
  Menu,
  X,
  BarChart3,
  PieChart as PieChartIcon,
  Printer,
  FileText,
  History,
  SearchCheck,
  ShieldCheck,
  School,
  BookOpen,
  DownloadCloud,
  FileSearch,
  ArrowLeftRight,
  Sun,
  Moon,
} from 'lucide-react';
import {
  APP_SWITCHER_ROUTE,
  DASHBOARD_ROUTE,
  MAPEL_AUDIT_ROUTE,
  MAPEL_DASHBOARD_ROUTE,
  MAPEL_HISTORY_ROUTE,
  MAPEL_SCHEDULE_ROUTE,
  MAPEL_SCORE_ROUTE,
  MAPEL_SESSION_ROUTE,
  TEACHER_PERFORMANCE_ROUTE,
} from '../shared/constants/routes';
import Button from '../shared/ui/Button';
import { cn } from '../shared/ui/cn';

const navBaseClass =
  'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200';

const navClassName = ({ isActive }) =>
  cn(
    navBaseClass,
    isActive
      ? 'bg-blue-600 text-white shadow-md shadow-blue-200/80'
      : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'
  );

const SectionLabel = ({ children }) => (
  <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">{children}</p>
);

const AppShell = ({
  isSidebarOpen,
  setSidebarOpen,
  isPiket,
  isExec,
  isWalas,
  isAdmin,
  canAccessMapel,
  canAccessMapelAudit,
  hasMultiWorkspace,
  deferredPrompt,
  handleInstallClick,
  userData,
  userRole,
  isDark,
  toggleTheme,
  handleLogout,
  children,
}) => {
  const location = useLocation();
  const isAuditRoute = location.pathname === MAPEL_AUDIT_ROUTE;
  const isMapelWorkspace = location.pathname.startsWith('/mapel') && !isAuditRoute;
  const isKesiswaanRole = userRole === 'kesiswaan';
  const isKurikulumRole = userRole === 'kurikulum';
  const showExecutiveControlMenu = isExec && !isKurikulumRole;
  const showTeacherPerformanceMenu = isExec && !isKesiswaanRole;

  const navMapel = [
    { to: MAPEL_SCHEDULE_ROUTE, icon: BookOpen, label: 'Jadwal Mengajar' },
    { to: MAPEL_SESSION_ROUTE, icon: ClipboardCheck, label: 'Sesi & Absensi' },
    { to: MAPEL_SCORE_ROUTE, icon: BarChart3, label: 'Nilai Harian' },
    { to: MAPEL_HISTORY_ROUTE, icon: History, label: 'Riwayat Sesi' },
  ];

  const dashboardNavItem = isPiket
    ? { to: '/piket-dashboard', icon: PieChartIcon, label: 'Dashboard Piket' }
    : isMapelWorkspace && canAccessMapel
      ? { to: MAPEL_DASHBOARD_ROUTE, icon: LayoutDashboard, label: 'Dashboard Mapel' }
      : showExecutiveControlMenu
        ? { to: DASHBOARD_ROUTE, icon: LayoutDashboard, label: 'Executive Control' }
        : !isExec
          ? { to: DASHBOARD_ROUTE, icon: LayoutDashboard, label: 'Dashboard' }
          : null;

  const navMain = [
    ...(hasMultiWorkspace
      ? [{ to: APP_SWITCHER_ROUTE, icon: ArrowLeftRight, label: 'Pilih Workspace' }]
      : []),
    ...(dashboardNavItem ? [dashboardNavItem] : []),
    ...(!isMapelWorkspace && showTeacherPerformanceMenu
      ? [{ to: TEACHER_PERFORMANCE_ROUTE, icon: BarChart3, label: 'Teacher Performance' }]
      : []),
    ...(!isMapelWorkspace && canAccessMapelAudit
      ? [{ to: MAPEL_AUDIT_ROUTE, icon: FileSearch, label: 'Audit Trail Mapel' }]
      : []),
  ];

  const navPiket = [
    { to: '/piket-absen-global', icon: SearchCheck, label: 'Koreksi Absen' },
    { to: '/piket-input', icon: Printer, label: 'Layanan Piket' },
    { to: '/rekap-piket', icon: History, label: 'Histori Layanan' },
  ];

  const navWalasOps = [{ to: '/absen', icon: ClipboardCheck, label: 'Input Absensi' }];
  const navWalasReport = [
    { to: '/rekap', icon: FileText, label: 'Log Absensi' },
    { to: '/akumulasi', icon: BarChart3, label: 'Akumulasi' },
  ];
  const navAdmin = [
    { to: '/manajemen-user', icon: ShieldCheck, label: 'User & Akses' },
    { to: '/manajemen-kelas', icon: School, label: 'Data Kelas' },
    { to: '/manajemen-siswa', icon: Users, label: 'Data Siswa' },
    { to: '/manajemen-mapel', icon: BookOpen, label: 'Mata Pelajaran' },
  ];

  return (
    <div className="app-texture relative flex min-h-screen text-slate-800">
      {isSidebarOpen && (
        <button
          className="fixed inset-0 z-40 bg-slate-900/45 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close menu overlay"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex h-screen w-[290px] flex-col border-r border-slate-200/80 bg-white/92 px-4 py-4 backdrop-blur-xl transition-transform duration-300 md:translate-x-0',
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="mb-5 flex items-center justify-between px-2">
          <div>
            <h1 className="text-xl font-black uppercase tracking-tight text-blue-700">Jingga Asik</h1>
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400">Smart Attendance</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 md:hidden"
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto pr-1 pb-3">
          <div className="space-y-2">
            <SectionLabel>Main Menu</SectionLabel>
            <div className="space-y-1">
              {navMain.map(({ to, icon, label }) => (
                <NavLink key={to} to={to} onClick={() => setSidebarOpen(false)} className={navClassName}>
                  {React.createElement(icon, { size: 17, className: 'shrink-0' })}
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>
          </div>

          {isPiket && (
            <div className="space-y-2">
              <SectionLabel>Layanan Piket</SectionLabel>
              <div className="space-y-1">
                {navPiket.map(({ to, icon, label }) => (
                  <NavLink key={to} to={to} onClick={() => setSidebarOpen(false)} className={navClassName}>
                    {React.createElement(icon, { size: 17, className: 'shrink-0' })}
                    <span>{label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          )}

          {isMapelWorkspace && canAccessMapel && (
            <div className="space-y-2">
              <SectionLabel>Modul Mapel</SectionLabel>
              <div className="space-y-1">
                {navMapel.map(({ to, icon, label }) => (
                  <NavLink key={to} to={to} onClick={() => setSidebarOpen(false)} className={navClassName}>
                    {React.createElement(icon, { size: 17, className: 'shrink-0' })}
                    <span>{label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          )}

          {isWalas && !isMapelWorkspace && (
            <div className="space-y-2">
              <SectionLabel>Operasional</SectionLabel>
              <div className="space-y-1">
                {navWalasOps.map(({ to, icon, label }) => (
                  <NavLink key={to} to={to} onClick={() => setSidebarOpen(false)} className={navClassName}>
                    {React.createElement(icon, { size: 17, className: 'shrink-0' })}
                    <span>{label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          )}

          {isWalas && !isMapelWorkspace && (
            <div className="space-y-2">
              <SectionLabel>Laporan</SectionLabel>
              <div className="space-y-1">
                {navWalasReport.map(({ to, icon, label }) => (
                  <NavLink key={to} to={to} onClick={() => setSidebarOpen(false)} className={navClassName}>
                    {React.createElement(icon, { size: 17, className: 'shrink-0' })}
                    <span>{label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          )}

          {isAdmin && (
            <div className="space-y-2">
              <SectionLabel>Admin Panel</SectionLabel>
              <div className="space-y-1">
                {navAdmin.map(({ to, icon, label }) => (
                  <NavLink key={to} to={to} onClick={() => setSidebarOpen(false)} className={navClassName}>
                    {React.createElement(icon, { size: 17, className: 'shrink-0' })}
                    <span>{label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          )}
        </nav>

        <div className="mt-3 space-y-3 border-t border-slate-200 pt-3">
          {deferredPrompt && (
            <Button onClick={handleInstallClick} className="w-full justify-center">
              <DownloadCloud size={16} /> Install Aplikasi
            </Button>
          )}

          <div className="premium-card flex items-center gap-3 rounded-xl px-3 py-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-sm font-bold uppercase text-white">
              {userData?.nama_lengkap?.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800">{userData?.nama_lengkap}</p>
              <p className="truncate text-[11px] font-medium uppercase tracking-wide text-blue-600">{userRole}</p>
            </div>
          </div>

          <Button onClick={handleLogout} variant="danger" className="w-full justify-center">
            <LogOut size={16} /> Keluar
          </Button>
        </div>
      </aside>

      <main className="flex min-h-screen w-full flex-1 flex-col md:ml-[290px]">
        <header
          className={cn(
            'sticky top-0 z-30 border-b px-4 py-3 backdrop-blur-xl md:px-8',
            isDark ? 'border-slate-700/70 bg-slate-900/85' : 'border-slate-200/80 bg-white/90'
          )}
        >
          <div className="mx-auto flex max-w-[1400px] items-center justify-end">
            <div className="mr-auto md:hidden">
              <button
                onClick={() => setSidebarOpen(true)}
                className="rounded-lg border border-slate-200 p-2 text-slate-600 md:hidden"
                aria-label="Open sidebar"
              >
                <Menu size={20} />
              </button>
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              className={cn(
                'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold',
                isDark
                  ? 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              )}
              aria-label="Toggle theme"
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? <Sun size={15} className="text-amber-500" /> : <Moon size={15} className="text-blue-600" />}
              <span className="hidden sm:inline">{isDark ? 'Light' : 'Dark'}</span>
            </button>
          </div>
        </header>

        <div className="mx-auto w-full max-w-[1400px] flex-1 p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
};

export default AppShell;
