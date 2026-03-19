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
          </div>

          <p className="mt-6 text-center text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
            Build with love for SMKN 1 Rongga
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;

