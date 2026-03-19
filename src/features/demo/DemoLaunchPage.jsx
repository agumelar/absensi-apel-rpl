/**
 * DemoLaunchPage – dirender saat seseorang mengakses /demo atau /demo/:role.
 * Secara otomatis mengaktifkan demo mode dan login tanpa perlu klik tombol.
 *
 * URL yang didukung:
 *   /demo            → login sebagai Kepala Sekolah (kepsek)
 *   /demo/kepsek     → login sebagai Kepala Sekolah
 *   /demo/walas1     → login sebagai Wali Kelas XI RPL 1
 *   /demo/piket      → login sebagai Guru Piket
 *   /demo/admin      → login sebagai Administrator
 *   ... (semua username di walikelas demo)
 */
import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { enableDemoMode } from '../../demo/demoMode';
import { walikelas as demoUsers } from '../../demo/demoData';

const DEFAULT_DEMO_ROLE = 'kepsek';

const DemoLaunchPage = ({ onLogin }) => {
  const onLoginRef = useRef(onLogin);

  useEffect(() => {
    // Ambil role dari pathname, contoh: /demo/piket → 'piket'
    const pathParts = window.location.pathname.split('/').filter(Boolean);
    const requestedRole = pathParts[1] ?? DEFAULT_DEMO_ROLE;

    const demoUser =
      demoUsers.find((u) => u.username === requestedRole) ??
      demoUsers.find((u) => u.username === DEFAULT_DEMO_ROLE);

    if (!demoUser) return;

    enableDemoMode();
    // Panggil onLogin dengan data user demo – sama seperti klik di modal
    onLoginRef.current({ ...demoUser, _isDemo: true });
  }, []);

  return (
    <div className="app-texture flex min-h-screen items-center justify-center bg-blue-50">
      <div className="flex flex-col items-center gap-4 text-slate-500">
        <Loader2 size={40} className="animate-spin text-blue-500" />
        <p className="text-sm font-semibold">Memuat Mode Demo…</p>
      </div>
    </div>
  );
};

export default DemoLaunchPage;
