import React, { useState } from 'react';
import { supabase } from './supabaseClient';
import { Lock, User, Loader2 } from 'lucide-react';
import Swal from 'sweetalert2';

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
    <div className="min-h-screen bg-blue-600 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-[40px] p-10 shadow-2xl">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-black text-gray-800 italic">JINGGA ASIK</h1>
          <p className="text-gray-400 font-bold text-xs uppercase mt-2">Silakan Masuk ke Sistem</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="text-[10px] font-black text-gray-400 ml-2">USERNAME</label>
            <div className="flex items-center bg-gray-50 p-4 rounded-2xl border border-gray-100 mt-1">
              <User size={20} className="text-gray-400 mr-3" />
              <input 
                type="text" 
                className="bg-transparent outline-none w-full font-bold" 
                placeholder="Masukkan username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black text-gray-400 ml-2">PASSWORD</label>
            <div className="flex items-center bg-gray-50 p-4 rounded-2xl border border-gray-100 mt-1">
              <Lock size={20} className="text-gray-400 mr-3" />
              <input 
                type="password" 
                className="bg-transparent outline-none w-full font-bold" 
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black shadow-xl shadow-blue-200 transition-all flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" /> : 'MASUK SEKARANG'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;