import React, { useState } from 'react';
import { supabase } from '../../../supabaseClient';
import { Lock, User, Loader2 } from 'lucide-react';
import Swal from 'sweetalert2';
import Button from '../../../shared/ui/Button';
import Card, { CardContent } from '../../../shared/ui/Card';
import InputField from '../../../shared/ui/InputField';

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    
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
                type="password"
                placeholder="Masukkan password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button type="submit" disabled={loading} size="lg" className="w-full">
              {loading ? <Loader2 className="animate-spin" /> : 'Masuk Sekarang'}
            </Button>
          </form>

          <p className="mt-8 text-center text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
            Build with love for SMKN 1 Rongga
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
