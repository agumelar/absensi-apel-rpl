import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import { 
  LayoutDashboard, ClipboardCheck, Users, LogOut, Menu, X, 
  BarChart3, PieChart as PieChartIcon, Printer, FileText, 
  History, SearchCheck, ShieldCheck, School, Briefcase, GraduationCap,
  DownloadCloud
} from 'lucide-react';

import Dashboard from './Dashboard';
import ExecutiveDashboard from './ExecutiveDashboard'; 
import PiketDashboard from './PiketDashboard';
import PiketInput from './PiketInput';
import RekapPiket from './RekapPiket';
import PiketAbsensiGlobal from './PiketAbsensiGlobal';
import HalamanAbsen from './HalamanAbsen';
import RekapAbsen from './RekapAbsen';
import AkumulasiSiswa from './AkumulasiSiswa';
import ManajemenSiswa from './ManajemenSiswa';
import ManajemenUser from './ManajemenUser';
import Login from './Login';
import PublicMonitoring from './PublicMonitoring';
import ManajemenKelas from './ManajemenKelas';

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userData, setUserData] = useState(null);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  
  // LOGIKA PWA
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    // Tangkap event installasi dari browser
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });

    // Hilangkan tombol jika sudah diinstall
    window.addEventListener('appinstalled', () => {
      setDeferredPrompt(null);
    });
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    }
  };

  const handleLoginSuccess = (data) => {
    setUserData(data);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUserData(null);
    setSidebarOpen(false);
  };

  if (!isLoggedIn && window.location.pathname === '/monitoring') {
    return (
      <Router>
        <Routes>
          <Route path="/monitoring" element={<PublicMonitoring />} />
        </Routes>
      </Router>
    );
  }

  if (!isLoggedIn) return <Login onLogin={handleLoginSuccess} />;

  const userRole = userData?.role?.toLowerCase();
  const isAdmin = userRole === 'admin';
  const isPiket = userRole === 'piket';
  const isExec = ['kepsek', 'kesiswaan', 'kaprog'].includes(userRole);
  const isWalas = userRole === 'walas' || userRole === 'walikelas';

  const dashboardLink = isPiket ? '/piket-dashboard' : '/dashboard';

  return (
    <Router>
      <div className="flex min-h-screen bg-gray-50 font-sans relative text-gray-800">
        {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarOpen(false)}></div>}

        <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-gray-100 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform duration-300 ease-in-out shadow-2xl md:shadow-none`}>
          <div className="p-6 flex justify-between items-center">
            <h1 className="text-2xl font-black text-blue-600 italic tracking-tighter uppercase leading-none text-left">JINGGA ASIK</h1>
            <button onClick={() => setSidebarOpen(false)} className="md:hidden p-2 text-gray-400"><X size={24} /></button>
          </div>

          <nav className="mt-6 px-4 space-y-8 overflow-y-auto max-h-[calc(100vh-250px)]">
            <div>
              <p className="px-4 text-[9px] font-black text-gray-400 uppercase tracking-[0.3em] mb-3 italic text-left">Main Menu</p>
              <div className="space-y-1">
                {isPiket ? (
                  <Link to="/piket-dashboard" onClick={() => setSidebarOpen(false)} className="flex items-center gap-3 p-3 rounded-2xl font-bold text-gray-600 hover:bg-blue-50 transition-all text-xs uppercase">
                    <PieChartIcon size={18} className="text-blue-600" /> Dashboard Piket
                  </Link>
                ) : (
                  <Link to="/dashboard" onClick={() => setSidebarOpen(false)} className="flex items-center gap-3 p-3 rounded-2xl font-bold text-gray-600 hover:bg-blue-50 transition-all text-xs uppercase">
                    <LayoutDashboard size={18} className="text-blue-600" /> {isExec ? 'Executive Control' : 'Dashboard'}
                  </Link>
                )}
              </div>
            </div>

            {isPiket && (
              <div>
                <p className="px-4 text-[9px] font-black text-gray-400 uppercase tracking-[0.3em] mb-3 italic text-left">Layanan Piket</p>
                <div className="space-y-1 text-left">
                  <Link to="/piket-absen-global" onClick={() => setSidebarOpen(false)} className="flex items-center gap-3 p-3 rounded-2xl font-bold text-gray-600 hover:bg-blue-50 transition-all text-xs uppercase"><SearchCheck size={18} className="text-blue-600" /> Koreksi Absen</Link>
                  <Link to="/piket-input" onClick={() => setSidebarOpen(false)} className="flex items-center gap-3 p-3 rounded-2xl font-bold text-gray-600 hover:bg-blue-50 transition-all text-xs uppercase"><Printer size={18} className="text-blue-600" /> Layanan Piket</Link>
                  <Link to="/rekap-piket" onClick={() => setSidebarOpen(false)} className="flex items-center gap-3 p-3 rounded-2xl font-bold text-gray-600 hover:bg-blue-50 transition-all text-xs uppercase"><History size={18} className="text-blue-600" /> Histori Layanan</Link>
                </div>
              </div>
            )}

            {isWalas && (
              <div className="text-left">
                <p className="px-4 text-[9px] font-black text-gray-400 uppercase tracking-[0.3em] mb-3 italic">Operasional</p>
                <Link to="/absen" onClick={() => setSidebarOpen(false)} className="flex items-center gap-3 p-3 rounded-2xl font-bold text-gray-600 hover:bg-blue-50 transition-all text-xs uppercase"><ClipboardCheck size={18} className="text-blue-600" /> Input Absensi</Link>
              </div>
            )}

            {isWalas && (
              <div className="text-left">
                <p className="px-4 text-[9px] font-black text-gray-400 uppercase tracking-[0.3em] mb-3 italic">Laporan</p>
                <div className="space-y-1">
                  <Link to="/rekap" onClick={() => setSidebarOpen(false)} className="flex items-center gap-3 p-3 rounded-2xl font-bold text-gray-600 hover:bg-blue-50 transition-all text-xs uppercase"><FileText size={18} className="text-blue-600" /> Log Absensi</Link>
                  <Link to="/akumulasi" onClick={() => setSidebarOpen(false)} className="flex items-center gap-3 p-3 rounded-2xl font-bold text-gray-600 hover:bg-blue-50 transition-all text-xs uppercase"><BarChart3 size={18} className="text-blue-600" /> Akumulasi</Link>
                </div>
              </div>
            )}

            {isAdmin && (
              <div className="bg-gray-50 p-4 rounded-[30px] border border-gray-100 text-left">
                <p className="px-2 text-[9px] font-black text-blue-600 uppercase tracking-[0.3em] mb-3 italic text-center">Admin Panel</p>
                <div className="space-y-1">
                  <Link to="/manajemen-user" onClick={() => setSidebarOpen(false)} className="flex items-center gap-3 p-3 rounded-xl font-bold text-gray-600 hover:bg-white hover:shadow-sm transition-all text-[10px] uppercase"><ShieldCheck size={16} className="text-blue-600" /> User & Akses</Link>
                  <Link to="/manajemen-kelas" onClick={() => setSidebarOpen(false)} className="flex items-center gap-3 p-3 rounded-xl font-bold text-gray-600 hover:bg-white hover:shadow-sm transition-all text-[10px] uppercase"><School size={16} className="text-blue-600" /> Data Kelas</Link>
                  <Link to="/manajemen-siswa" onClick={() => setSidebarOpen(false)} className="flex items-center gap-3 p-3 rounded-xl font-bold text-gray-600 hover:bg-white hover:shadow-sm transition-all text-[10px] uppercase"><Users size={16} className="text-blue-600" /> Data Siswa</Link>
                </div>
              </div>
            )}
          </nav>

          <div className="absolute bottom-0 w-full p-6 border-t border-gray-50 bg-white space-y-3">
            {/* TOMBOL INSTALL APLIKASI (Hanya muncul jika tersedia) */}
            {deferredPrompt && (
              <button 
                onClick={handleInstallClick}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-blue-600 text-white font-bold text-[10px] hover:bg-blue-700 transition-all uppercase tracking-widest"
              >
                <DownloadCloud size={14} /> Install Aplikasi
              </button>
            )}

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-black uppercase text-sm">{userData?.nama_lengkap?.charAt(0)}</div>
              <div className="overflow-hidden text-left">
                <p className="text-[10px] font-black text-gray-800 truncate uppercase">{userData?.nama_lengkap}</p>
                <p className="text-[8px] font-bold text-blue-500 uppercase tracking-widest italic">{userRole}</p>
              </div>
            </div>
            <button onClick={handleLogout} className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-red-50 text-red-600 font-bold text-[10px] hover:bg-red-100 transition-all uppercase tracking-widest"><LogOut size={14} /> Keluar</button>
          </div>
        </aside>

        <main className="flex-1 w-full md:ml-72 flex flex-col min-h-screen">
          <header className="md:hidden bg-white/90 backdrop-blur-md p-4 border-b border-gray-100 flex justify-between items-center sticky top-0 z-30">
            <h1 className="text-lg font-black text-blue-600 italic uppercase leading-none tracking-tighter text-left">JINGGA ASIK</h1>
            <button onClick={() => setSidebarOpen(true)} className="p-2 bg-blue-50 text-blue-600 rounded-xl"><Menu size={24} /></button>
          </header>

          <div className="p-4 md:p-10 flex-grow">
            <Routes>
              <Route path="/monitoring" element={<PublicMonitoring />} />
              <Route path="/dashboard" element={isExec ? <ExecutiveDashboard user={userData} /> : <Dashboard user={userData} />} />
              <Route path="/piket-dashboard" element={(isPiket || isAdmin) ? <PiketDashboard user={userData} /> : <Navigate to="/dashboard" />} />
              <Route path="/piket-input" element={(isPiket || isAdmin) ? <PiketInput user={userData} /> : <Navigate to="/dashboard" />} />
              <Route path="/piket-absen-global" element={(isPiket || isAdmin) ? <PiketAbsensiGlobal /> : <Navigate to="/dashboard" />} />
              <Route path="/rekap-piket" element={(isPiket || isAdmin) ? <RekapPiket /> : <Navigate to="/dashboard" />} />
              <Route path="/absen" element={(isWalas || isAdmin) ? <HalamanAbsen user={userData} /> : <Navigate to="/dashboard" />} />
              <Route path="/rekap" element={(isWalas || isAdmin) ? <RekapAbsen user={userData} /> : <Navigate to="/dashboard" />} />
              <Route path="/akumulasi" element={(isWalas || isAdmin) ? <AkumulasiSiswa user={userData} /> : <Navigate to="/dashboard" />} />
              <Route path="/manajemen-siswa" element={isAdmin ? <ManajemenSiswa /> : <Navigate to="/dashboard" />} />
              <Route path="/manajemen-user" element={isAdmin ? <ManajemenUser /> : <Navigate to="/dashboard" />} />
              <Route path="/manajemen-kelas" element={isAdmin ? <ManajemenKelas /> : <Navigate to="/dashboard" />} />
              <Route path="/" element={<Navigate to={dashboardLink} />} />
            </Routes>
          </div>
        </main>
      </div>
    </Router>
  );
};

export default App;