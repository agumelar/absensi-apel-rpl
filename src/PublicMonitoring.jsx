import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { 
  Sun, Moon, Trophy, AlertTriangle, 
  Monitor, Loader2, Clock
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const PublicMonitoring = () => {
  const [darkMode, setDarkMode] = useState(true);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ hadir: 0, terlambat: 0, sakit: 0, izin: 0, alpha: 0 });
  const [rankingKelas, setRankingKelas] = useState([]);
  const [siswaRajin, setSiswaRajin] = useState([]);
  const [currentSiswaIdx, setCurrentSiswaIdx] = useState(0);

  useEffect(() => {
    fetchPublicData();
    // Refresh Data: 1 Jam Sekali (3600000 ms) agar hemat kuota
    const dataInterval = setInterval(() => fetchPublicData(), 3600000);
    
    // Carousel Siswa Teladan: Tetap 5 detik biar dinamis
    const carouselInterval = setInterval(() => {
      setCurrentSiswaIdx(prev => (prev + 1) % (siswaRajin.length || 1));
    }, 5000);
    
    return () => { clearInterval(dataInterval); clearInterval(carouselInterval); };
  }, [siswaRajin.length]);

  const fetchPublicData = async () => {
    try {
      const hariIni = new Date().toISOString().split('T')[0];
      const { data: dataAbsen } = await supabase.from('absensi').select('status').eq('tanggal', hariIni);
      const counts = { Hadir: 0, Kesiangan: 0, Sakit: 0, Izin: 0, Alpha: 0 };
      dataAbsen?.forEach(a => { if(counts.hasOwnProperty(a.status)) counts[a.status]++ });
      setStats({ hadir: counts.Hadir, terlambat: counts.Kesiangan, sakit: counts.Sakit, izin: counts.Izin, alpha: counts.Alpha });

      const { data: mKelas } = await supabase.from('master_kelas').select('id, nama_kelas');
      const { data: mSiswa } = await supabase.from('siswa').select('id, kelas_id').eq('status_siswa', 'Aktif');
      const { data: aHariIni } = await supabase.from('absensi').select('status, siswa!inner(kelas_id)').eq('tanggal', hariIni);

      const rekapKelas = {};
      mKelas?.forEach(k => { rekapKelas[k.id] = { nama: k.nama_kelas, s: 0, i: 0, a: 0, totalSiswa: 0, skor: 0 }; });
      mSiswa?.forEach(s => { if (rekapKelas[s.kelas_id]) rekapKelas[s.kelas_id].totalSiswa++; });
      aHariIni?.forEach(a => {
        const kId = a.siswa?.kelas_id;
        if (rekapKelas[kId]) {
          if (a.status === 'Sakit') rekapKelas[kId].s++;
          if (a.status === 'Izin') rekapKelas[kId].i++;
          if (a.status === 'Alpha') rekapKelas[kId].a++;
        }
      });

      const ranking = Object.values(rekapKelas)
        .filter(k => k.totalSiswa > 0)
        .map(k => ({ ...k, skor: ((k.s + k.i + k.a) / k.totalSiswa) * 100 }))
        .sort((a, b) => b.skor - a.skor); 
      setRankingKelas(ranking);

      const skrg = new Date();
      const awalBulanIni = new Date(skrg.getFullYear(), skrg.getMonth(), 1).toISOString().split('T')[0];
      const { data: dataBulanIni } = await supabase.from('absensi').select('status, siswa!inner(nama_siswa, master_kelas(nama_kelas))').gte('tanggal', awalBulanIni).lte('tanggal', hariIni);

      const rekapSiswa = {};
      dataBulanIni?.forEach(d => {
        const n = d.siswa.nama_siswa;
        if (!rekapSiswa[n]) rekapSiswa[n] = { nama: n, kelas: d.siswa.master_kelas?.nama_kelas, bolos: 0 };
        if (['Sakit', 'Izin', 'Alpha', 'Kesiangan'].includes(d.status)) rekapSiswa[n].bolos++;
      });
      setSiswaRajin(Object.values(rekapSiswa).filter(s => s.bolos === 0).slice(0, 10));
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const COLORS = { Hadir: '#10b981', Terlambat: '#facc15', Sakit: '#f59e0b', Izin: '#3b82f6', Alpha: '#ef4444' };
  const chartData = [
    { name: 'Hadir', value: stats.hadir }, { name: 'Terlambat', value: stats.terlambat },
    { name: 'Sakit', value: stats.sakit }, { name: 'Izin', value: stats.izin }, { name: 'Alpha', value: stats.alpha },
  ].filter(d => d.value > 0);

  if (loading) return <div className="h-screen bg-gray-950 flex flex-col items-center justify-center"><Loader2 className="animate-spin text-blue-500 mb-4" size={60} /><p className="text-white font-black uppercase tracking-[0.5em] text-[8px]">Mengambil Data Terbaru...</p></div>;

  return (
    <div className={`min-h-screen transition-colors duration-700 font-sans ${darkMode ? 'bg-gray-950 text-white' : 'bg-gray-50 text-gray-900'}`}>
      <div className="max-w-[1600px] mx-auto p-4 md:p-10">
        
        <header className="flex flex-col md:flex-row justify-between items-center mb-8 border-b border-white/5 pb-6 gap-6 text-left">
          <div className="flex items-center gap-4 text-left flex-col md:flex-row">
            <div className="bg-blue-600 p-3 rounded-2xl shadow-xl shadow-blue-500/20">
              <Monitor className="text-white" size={32} />
            </div>
            <div className="text-left">
              <h1 className="text-2xl md:text-4xl font-black italic uppercase tracking-tighter leading-none text-left">Live Monitoring</h1>
              <p className="text-[8px] md:text-xs font-black text-blue-500 tracking-[0.3em] uppercase mt-2 text-left">SMK NEGERI 1 RONGGA</p>
            </div>
          </div>
          <button onClick={() => setDarkMode(!darkMode)} className={`p-4 rounded-2xl transition-all ${darkMode ? 'bg-white/5 text-yellow-400 border border-white/10' : 'bg-white text-gray-400 shadow-xl'}`}>
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </header>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 md:gap-6 mb-8 text-left">
          {[
            { label: 'Hadir', val: stats.hadir, clr: 'text-green-500' },
            { label: 'Telat', val: stats.terlambat, clr: 'text-yellow-500' },
            { label: 'Sakit', val: stats.sakit, clr: 'text-orange-500' },
            { label: 'Izin', val: stats.izin, clr: 'text-blue-500' },
            { label: 'Alpha', val: stats.alpha, clr: 'text-red-500' },
          ].map((s, i) => (
            <div key={i} className="p-5 md:p-8 rounded-[30px] bg-white/5 border border-white/5 flex flex-col items-center justify-center text-center">
              <h2 className={`text-2xl md:text-5xl font-black mb-1 tracking-tighter ${s.clr}`}>{s.val}</h2>
              <p className="text-[7px] md:text-[9px] font-black uppercase tracking-widest opacity-40 italic">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-10">
          <div className={`lg:col-span-2 p-5 md:p-10 rounded-[40px] shadow-2xl ${darkMode ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-100'}`}>
            <h3 className="text-sm md:text-xl font-black uppercase mb-6 flex items-center gap-3 italic text-red-500 tracking-tighter text-left">
              <AlertTriangle size={24} /> Ranking Ketidakhadiran
            </h3>
            <div className="overflow-x-auto rounded-[25px] border border-white/5">
              <table className="w-full text-left min-w-[450px]">
                <thead>
                  <tr className={darkMode ? 'bg-white/10' : 'bg-gray-900 text-white'}>
                    <th className="p-4 text-[8px] md:text-[10px] font-black uppercase tracking-widest text-center">Rank</th>
                    <th className="p-4 text-[8px] md:text-[10px] font-black uppercase tracking-widest text-left">Kelas</th>
                    <th className="p-4 text-[8px] md:text-[10px] font-black uppercase tracking-widest text-center">S/I/A</th>
                    <th className="p-4 text-[8px] md:text-[10px] font-black uppercase tracking-widest text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {rankingKelas.slice(0, 8).map((k, idx) => (
                    <tr key={idx} className="hover:bg-white/5 transition-all">
                      <td className="p-4 font-black italic text-xl md:text-3xl text-blue-500 text-center">#{idx + 1}</td>
                      <td className="p-4 font-black uppercase text-[10px] md:text-lg text-left">{k.nama}</td>
                      <td className="p-4 text-center font-black text-xs md:text-lg text-red-400">{k.s + k.i + k.a}</td>
                      <td className="p-4 text-right">
                        <span className={`px-2 py-1 md:px-3 md:py-1.5 rounded-xl text-[6px] md:text-[9px] font-black uppercase ${k.skor > 15 ? 'bg-red-600 text-white' : k.skor > 8 ? 'bg-yellow-500 text-gray-900' : 'bg-green-600 text-white'}`}>
                          {k.skor > 15 ? 'Bahaya' : k.skor > 8 ? 'Waspada' : 'Aman'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col gap-6 md:gap-10">
            <div className={`p-8 md:p-10 rounded-[40px] flex flex-col items-center ${darkMode ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-100'}`}>
               <h3 className="text-[10px] font-black uppercase tracking-widest mb-4 opacity-50 italic">Sebaran Harian</h3>
               <div className="w-full h-[180px] md:h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chartData} innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={5}>
                      {chartData.map((entry, index) => <Cell key={index} fill={COLORS[entry.name]} stroke="none" />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', fontWeight: '900', fontSize: '10px' }} />
                  </PieChart>
                </ResponsiveContainer>
               </div>
            </div>

            <div className="bg-blue-600 p-8 rounded-[40px] shadow-2xl text-white relative overflow-hidden h-[220px] md:h-[250px] flex flex-col justify-center border-4 border-white/10 text-left">
               <Trophy className="absolute -right-10 -bottom-10 opacity-10 rotate-12" size={180} />
               <div className="relative z-10 text-center md:text-left">
                  <h3 className="text-[8px] font-black uppercase tracking-widest mb-4 text-blue-200">⭐ Siswa Teladan ⭐</h3>
                  {siswaRajin.length > 0 ? (
                    <div className="animate-in slide-in-from-bottom-5 duration-700">
                      <h2 className="text-xl md:text-4xl font-black uppercase leading-tight italic tracking-tighter mb-2">
                        {siswaRajin[currentSiswaIdx]?.nama}
                      </h2>
                      <p className="text-[9px] md:text-sm font-black text-blue-100 uppercase tracking-widest">{siswaRajin[currentSiswaIdx]?.kelas}</p>
                    </div>
                  ) : (
                    <p className="opacity-50 text-[10px] uppercase font-black text-left">Menghitung Data...</p>
                  )}
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicMonitoring;