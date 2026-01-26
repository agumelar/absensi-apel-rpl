import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Swal from 'sweetalert2';
import { Calendar, FileText, Image, Clock, User, Loader2, ArrowRight, RefreshCw, CheckCircle2, XCircle, Info } from 'lucide-react';

const RekapAbsen = ({ user }) => {
  const [rekap, setRekap] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dariTanggal, setDariTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [sampaiTanggal, setSampaiTanggal] = useState(new Date().toISOString().split('T')[0]);
  
  const [counters, setCounters] = useState({ hadir: 0, sakit: 0, izin: 0, kesiangan: 0, alpha: 0 });

  useEffect(() => {
    // Pastikan user sudah login dan punya kelas_id
    if (user) {
      fetchRekap();
    }
  }, [dariTanggal, sampaiTanggal, user]);

  const fetchRekap = async () => {
    try {
      setLoading(true);
      
      // FIX 1: Gunakan kelas_id dari data user
      const kelasIdTarget = user?.kelas_id;

      if (!kelasIdTarget && user?.role !== 'admin') {
         console.error("User tidak punya ID Kelas");
         setLoading(false);
         return;
      }

      // FIX 2: Query join ke siswa dengan filter kelas_id
      let query = supabase
        .from('absensi')
        .select(`
          id, 
          tanggal, 
          status, 
          jam_hadir, 
          bukti_url, 
          siswa!inner (nama_siswa, nis, kelas_id)
        `)
        .gte('tanggal', dariTanggal)
        .lte('tanggal', sampaiTanggal);

      // Hanya tampilkan data milik kelas walas tersebut (berdasarkan ID)
      if (user?.role !== 'admin') {
        query = query.eq('siswa.kelas_id', kelasIdTarget);
      }

      const { data, error } = await query.order('tanggal', { ascending: false });
      if (error) throw error;
      
      setRekap(data || []);
      
      // Hitung Counter otomatis
      const c = { hadir: 0, sakit: 0, izin: 0, kesiangan: 0, alpha: 0 };
      data.forEach(item => {
        const s = item.status.toLowerCase();
        // Cek kecocokan key untuk menghindari error
        if (Object.keys(c).includes(s)) c[s]++;
      });
      setCounters(c);

    } catch (error) {
      console.error('Error:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const tampilkanFoto = (url) => {
    Swal.fire({
      title: 'Bukti Absensi',
      imageUrl: url,
      imageAlt: 'Foto Bukti',
      confirmButtonColor: '#2563eb',
      customClass: { popup: 'rounded-[30px]', image: 'rounded-2xl' }
    });
  };

  return (
    <div className="max-w-6xl mx-auto pb-20 p-4 font-sans text-gray-800">
      <header className="mb-8">
        <h1 className="text-4xl font-black italic tracking-tighter uppercase text-gray-800">Log Detail Absensi</h1>
        <p className="text-blue-600 font-bold text-[10px] tracking-[0.3em] uppercase">
          Monitoring Real-Time • {user?.kelas_diampu || 'ADMIN'}
        </p>
      </header>

      {/* COUNTER CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {[
          { label: 'Hadir', count: counters.hadir, color: 'text-green-600', bg: 'bg-green-50', icon: <CheckCircle2 size={16}/> },
          { label: 'Sakit', count: counters.sakit, color: 'text-orange-500', bg: 'bg-orange-50', icon: <Info size={16}/> },
          { label: 'Izin', count: counters.izin, color: 'text-blue-600', bg: 'bg-blue-50', icon: <FileText size={16}/> },
          { label: 'Kesiangan', count: counters.kesiangan, color: 'text-amber-600', bg: 'bg-amber-50', icon: <Clock size={16}/> },
          { label: 'Alpha', count: counters.alpha, color: 'text-red-600', bg: 'bg-red-50', icon: <XCircle size={16}/> },
        ].map((item) => (
          <div key={item.label} className={`${item.bg} p-5 rounded-[30px] border border-white shadow-sm flex flex-col items-center transition-transform hover:scale-105`}>
            <div className={`${item.color} mb-2`}>{item.icon}</div>
            <h2 className={`text-2xl font-black ${item.color}`}>{item.count}</h2>
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{item.label}</p>
          </div>
        ))}
      </div>

      {/* FILTER BOX */}
      <div className="bg-white p-6 rounded-[35px] shadow-sm border border-gray-100 mb-8 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-2xl border border-gray-100">
          <Calendar size={18} className="text-blue-600" />
          <input type="date" value={dariTanggal} onChange={(e) => setDariTanggal(e.target.value)} className="bg-transparent font-bold text-xs outline-none cursor-pointer" />
        </div>
        <ArrowRight size={16} className="text-gray-300" />
        <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-2xl border border-gray-100">
          <Calendar size={18} className="text-blue-600" />
          <input type="date" value={sampaiTanggal} onChange={(e) => setSampaiTanggal(e.target.value)} className="bg-transparent font-bold text-xs outline-none cursor-pointer" />
        </div>
        <button onClick={fetchRekap} className="ml-auto bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 uppercase">
           <RefreshCw size={14} /> Refresh Data
        </button>
      </div>

      {/* TABEL DATA */}
      <div className="bg-white rounded-[40px] shadow-sm border border-gray-50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50">
              <tr className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                <th className="p-6">Siswa</th>
                <th className="p-6 text-center">Tanggal</th>
                <th className="p-6 text-center">Status</th>
                <th className="p-6 text-center">Ket</th>
                <th className="p-6 text-right">Bukti</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan="5" className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-blue-600" /></td></tr>
              ) : rekap.length === 0 ? (
                <tr><td colSpan="5" className="p-20 text-center font-bold text-gray-300 uppercase italic text-xs">Data tidak ditemukan dalam rentang tanggal ini</td></tr>
              ) : (
                rekap.map((row) => (
                  <tr key={row.id} className="hover:bg-blue-50/10 transition-all">
                    <td className="p-6">
                      <p className="font-black text-gray-800 text-xs uppercase leading-tight">{row.siswa?.nama_siswa}</p>
                      <p className="text-[9px] text-gray-400 font-bold tracking-tighter uppercase font-mono">NIS: {row.siswa?.nis}</p>
                    </td>
                    <td className="p-6 text-center text-[10px] text-gray-500 font-bold uppercase">{row.tanggal}</td>
                    <td className="p-6 text-center">
                      <span className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase ${
                        row.status === 'Alpha' ? 'bg-red-100 text-red-600' : 
                        row.status === 'Hadir' ? 'bg-green-100 text-green-600' : 
                        row.status === 'Kesiangan' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
                      }`}>{row.status}</span>
                    </td>
                    <td className="p-6 text-center text-[10px] font-black text-orange-600 italic uppercase">{row.jam_hadir || '-'}</td>
                    <td className="p-6 text-right">
                      {row.bukti_url && (
                        <button onClick={() => tampilkanFoto(row.bukti_url)} className="text-blue-600 hover:scale-110 transition-transform inline-block">
                          <Image size={20} className="ml-auto" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RekapAbsen;