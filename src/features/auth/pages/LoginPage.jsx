import React, { useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { Eye, EyeOff, Lock, User, Loader2, FlaskConical } from 'lucide-react';
import Swal from 'sweetalert2';
import Button from '../../../shared/ui/Button';
import Card, { CardContent } from '../../../shared/ui/Card';
import InputField from '../../../shared/ui/InputField';
import { enableDemoMode, disableDemoMode } from '../../../demo/demoMode';
import { walikelas as demoUsers } from '../../../demo/demoData';

const DEMO_ROLES = [
  { username: 'kepsek',    label: 'Kepala Sekolah',      desc: 'Dashboard Eksekutif & Monitoring' },
  { username: 'kesiswaan', label: 'Kesiswaan',            desc: 'Executive Control, EWS Siswa' },
  { username: 'kaprog',    label: 'Kaprog Jurusan',       desc: 'Teacher Performance, Jurusan' },
  { username: 'kurikulum', label: 'Kurikulum',            desc: 'Teacher Performance & Audit' },
  { username: 'walas1',    label: 'Wali Kelas XI RPL 1',  desc: 'Absensi & Rekap Kelas' },
  { username: 'piket',     label: 'Guru Piket',           desc: 'Piket & EWS Guru Kosong' },
  { username: 'guru1',     label: 'Guru Mapel',           desc: 'Sesi Mapel & Presensi' },
  { username: 'tu',        label: 'TU',                   desc: 'Workspace Pembiasaan Harian' },
  { username: 'admin',     label: 'Administrator',        desc: 'Manajemen Siswa, User, Kelas' },
];

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    disableDemoMode();

    try {
      const { data, error } = await supabase
        .from('walikelas')
        .select('*')
        .eq('username', username)
        .eq('password', password)
        .single();

      if (error || !data) {
        Swal.fire({
          icon: 'error',
          title: 'Akses Ditolak!',
          text: 'Username atau Password salah, periksa lagi ya bro.',
          confirmButtonColor: '#2563eb',
          customClass: {
            popup: 'rounded-[30px]',
            confirmButton: 'rounded-xl px-10 py-3 font-black'
          }
        });
      } else {
        Swal.fire({
          icon: 'success',
          title: 'Berhasil Masuk!',
          text: `Selamat bertugas, ${data.nama_lengkap}`,
          showConfirmButton: false,
          timer: 1500,
          customClass: { popup: 'rounded-[30px]' }
        }).then(() => {
          onLogin(data);
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = (roleUsername) => {
    const demoUser = demoUsers.find((u) => u.username === roleUsername);
    if (!demoUser) return;
    enableDemoMode();
    onLogin({ ...demoUser, _isDemo: true });
  };

  return (
    <div className="app-texture min-h-screen bg-blue-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md rounded-3xl border-blue-100/80">
        <CardContent className="p-8 md:p-10">
          <div className="mb-8 flex flex-col items-center">
            <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <img
                src="/Jingga.png"
                alt="Logo SMKN 1 Rongga"
                className="h-full w-full object-contain"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            </div>
            <h1 className="text-4xl font-black tracking-tight text-slate-800">JINGGA ASIK</h1>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-600">
              Official SMKN 1 Rongga
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Username
              </label>
              <InputField
                icon={User}
                type="text"
                placeholder="Masukkan username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Password
              </label>
              <InputField
                icon={Lock}
                type={showPassword ? 'text' : 'password'}
                placeholder="Masukkan password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                endAdornment={
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                    aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                    title={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                }
                required
              />
            </div>

            <Button type="submit" disabled={loading} size="lg" className="w-full">
              {loading ? <Loader2 className="animate-spin" /> : 'Masuk Sekarang'}
            </Button>
          </form>

          {import.meta.env.VITE_DEMO_MODE === 'true' && (
            <>
              {/* Divider */}
              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">atau</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              {/* Demo Mode – 8 tombol langsung */}
              <div className="rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <FlaskConical size={16} className="shrink-0 text-amber-600" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
                    Mode Demo — Login Otomatis
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {DEMO_ROLES.map((role) => (
                    <button
                      key={role.username}
                      type="button"
                      onClick={() => handleDemoLogin(role.username)}
                      className="flex flex-col items-start rounded-xl border border-amber-200 bg-white px-3 py-2 text-left transition hover:border-amber-400 hover:bg-amber-50 active:scale-[0.98]"
                    >
                      <span className="text-xs font-bold text-slate-800 leading-tight">{role.label}</span>
                      <span className="mt-0.5 text-[10px] leading-tight text-slate-500">{role.desc}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-[10px] text-amber-700">
                  ⚠️ Data fiktif · perubahan tidak tersimpan ke server
                </p>

                {/* Kontak Developer */}
                <div className="mt-3 border-t border-amber-200 pt-3 flex items-center justify-center gap-4">
                  <a
                    href="https://www.instagram.com/gumelar16"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Hubungi developer di Instagram @gumelar16"
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold text-pink-600 transition hover:bg-pink-50"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="Instagram icon">
                      <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
                    </svg>
                    @gumelar16
                  </a>
                  <a
                    href="https://www.threads.net/@gumelar16"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Hubungi developer di Threads @gumelar16"
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 192 192" fill="currentColor" role="img" aria-label="Threads icon">
                      <path d="M141.537 88.988a66.667 66.667 0 0 0-2.518-1.143c-1.482-27.307-16.403-42.94-41.457-43.1h-.34c-14.986 0-27.449 6.396-35.12 18.036l13.779 9.452c5.73-8.695 14.724-10.548 21.348-10.548h.23c8.248.054 14.474 2.452 18.502 7.13 2.931 3.405 4.893 8.11 5.864 14.05-7.314-1.243-15.224-1.626-23.68-1.14-23.82 1.371-39.134 15.264-38.105 34.568.522 9.792 5.4 18.216 13.735 23.719 7.047 4.652 16.124 6.927 25.557 6.412 12.458-.683 22.231-5.436 29.05-14.127 5.177-6.6 8.452-15.153 9.898-25.93 5.937 3.583 10.337 8.298 12.767 13.966 4.132 9.635 4.373 25.468-8.546 38.376-11.319 11.308-24.925 16.2-45.488 16.351-22.809-.169-40.06-7.484-51.275-21.742C35.236 139.966 29.808 120.682 29.605 96c.203-24.682 5.63-43.966 16.133-57.317C56.954 24.425 74.206 17.11 97.015 16.94c22.975.17 40.526 7.52 52.171 21.847 5.71 7.026 10.015 15.86 12.853 26.162l16.147-4.308c-3.44-12.68-8.853-23.606-16.219-32.668C147.036 9.607 125.202.195 97.109 0h-.195C68.912.195 47.322 9.67 32.815 28.133 19.448 44.832 12.508 68.667 12.295 96v.512c.213 27.305 7.153 51.092 20.52 67.757C47.322 182.33 68.912 191.805 96.914 192h.195c24.922-.189 42.554-6.703 57.048-21.188 18.963-18.945 18.392-42.692 12.142-57.27-4.484-10.454-13.033-18.945-24.762-24.554Z"/>
                    </svg>
                    @gumelar16
                  </a>
                </div>
              </div>
            </>
          )}

          <p className="mt-6 text-center text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
            Build with love for SMKN 1 Rongga
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
