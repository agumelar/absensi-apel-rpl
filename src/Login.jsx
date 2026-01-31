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
        
        {/* BAGIAN LOGO SEKOLAH */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-24 h-24 bg-gray-50 rounded-3xl flex items-center justify-center p-4 mb-4 shadow-inner hover:scale-105 transition-transform duration-300">
            <img 
              src="/Jingga.png" 
              alt="Logo SMKN 1 Rongga" 
              className="w-full h-full object-contain"
              // Jika logo belum ada, gambar tidak akan pecah berlebihan
              onError={(e) => e.target.style.display = 'none'} 
            />
          </div>
          <h1 className="text-4xl font-black text-gray-800 italic tracking-tighter">JINGGA ASIK</h1>
          <p className="text-blue-600 font-black text-[10px] uppercase tracking-[0.3em] mt-1">
            Official SMKN 1 Rongga
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="text-[10px] font-black text-gray-400 ml-2 uppercase">Username</label>
            <div className="flex items-center bg-gray-50 p-4 rounded-2xl border border-gray-100 mt-1 focus-within:border-blue-300 transition-all">
              <User size={20} className="text-gray-400 mr-3" />
              <input 
                type="text" 
                className="bg-transparent outline-none w-full font-bold text-gray-700" 
                placeholder="Masukkan username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-black text-gray-400 ml-2 uppercase">Password</label>
            <div className="flex items-center bg-gray-50 p-4 rounded-2xl border border-gray-100 mt-1 focus-within:border-blue-300 transition-all">
              <Lock size={20} className="text-gray-400 mr-3" />
              <input 
                type="password" 
                className="bg-transparent outline-none w-full font-bold text-gray-700" 
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
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-black shadow-xl shadow-blue-200 transition-all flex items-center justify-center gap-2 active:scale-95"
          >
            {loading ? <Loader2 className="animate-spin" /> : 'MASUK SEKARANG'}
          </button>
        </form>
        
        <p className="text-center text-gray-300 text-[9px] font-bold mt-8 uppercase tracking-widest">
          Build with ❤️ for SMKN 1 Rongga by UP RPL
        </p>
      </div>
    </div>
  );
};

export default Login;