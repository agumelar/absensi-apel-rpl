import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { Sun, Moon, Trophy, AlertTriangle, Monitor, Loader2, Clock, Users } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const PublicMonitoring = () => {
  const [darkMode, setDarkMode] = useState(true);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ hadir: 0, terlambat: 0, sakit: 0, izin: 0, alpha: 0, totalSiswa: 0 });
  const [rankingKelas, setRankingKelas] = useState([]);
  const [siswaRajin, setSiswaRajin] = useState([]);
  const [currentSiswaIdx, setCurrentSiswaIdx] = useState(0);

  const getTodayDateWIB = () => {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
  };

  useEffect(() => {
    fetchPublicData();
    const dataInterval = setInterval(() => fetchPublicData(), 3600000);
    const carouselInterval = setInterval(() => {
      setCurrentSiswaIdx(prev => (prev + 1) % (siswaRajin.length || 1));
    }, 5000);
    return () => { clearInterval(dataInterval); clearInterval(carouselInterval); };
  }, [siswaRajin.length]);

  const fetchPublicData = async () => {
    try {
      const hariIni = getTodayDateWIB();
      
      // Ambil Total Siswa Aktif
      const { count: totalSiswaCount } = await supabase.from('siswa').select('*', { count: 'exact', head: true }).eq('status_siswa', 'Aktif');

      const { data: dataAbsen } = await supabase.from('absensi').select('status').eq('tanggal', hariIni);
      const counts = { Hadir: 0, Kesiangan: 0, Sakit: 0, Izin: 0, Alpha: 0 };
      dataAbsen?.forEach(a => { if(counts.hasOwnProperty(a.status)) counts[a.status]++ });
      
      setStats({ 
        hadir: counts.Hadir, terlambat: counts.Kesiangan, 
        sakit: counts.Sakit, izin: counts.Izin, alpha: counts.Alpha,
        totalSiswa: totalSiswaCount || 0
      });

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

      const awalBulanIni = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
      const { data: dataBulanIni } = await supabase.from('absensi').select('status, siswa!inner(nama_siswa, master_kelas(nama_kelas))').gte('tanggal', awalBulanIni);

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
  const chartData = [{ name: 'Hadir', value: stats.hadir }, { name: 'Terlambat', value: stats.terlambat }, { name: 'Sakit', value: stats.sakit }, { name: 'Izin', value: stats.izin }, { name: 'Alpha', value: stats.alpha }].filter(d => d.value > 0);

  if (loading) return <div className="h-screen bg-gray-950 flex flex-col items-center justify-center"><Loader2 className="animate-spin text-blue-500 mb-4" size={60} /></div>;

  return (
    <div className={`min-h-screen font-sans ${darkMode ? 'bg-gray-950 text-white' : 'bg-gray-50 text-gray-900'}`}>
      <div className="max-w-[1600px] mx-auto p-4 md:p-10">
        <header className="flex justify-between items-center mb-8 border-b border-white/5 pb-6">
          <div className="flex items-center gap-4">
            <Monitor className="text-blue-500" size={40} />
            <div>
              <h1 className="text-4xl font-black italic uppercase tracking-tighter">Live Monitoring</h1>
              <p className="text-xs font-black text-blue-500 uppercase">SMK NEGERI 1 RONGGA</p>
            </div>
          </div>
          <button onClick={() => setDarkMode(!darkMode)} className="p-4 rounded-2xl bg-white/5">{darkMode ? <Sun size={20} className="text-yellow-400"/> : <Moon size={20}/>}</button>
        </header>

        {/* BOX STATISTIK DENGAN TOTAL SISWA */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
          <div className="p-6 rounded-[30px] bg-blue-600 flex flex-col items-center justify-center">
            <h2 className="text-4xl font-black text-white">{stats.totalSiswa}</h2>
            <p className="text-[9px] font-black uppercase opacity-60">Total Siswa</p>
          </div>
          {[
            { label: 'Hadir', val: stats.hadir, clr: 'text-green-500' },
            { label: 'Telat', val: stats.terlambat, clr: 'text-yellow-500' },
            { label: 'Sakit', val: stats.sakit, clr: 'text-orange-500' },
            { label: 'Izin', val: stats.izin, clr: 'text-blue-500' },
            { label: 'Alpha', val: stats.alpha, clr: 'text-red-500' },
          ].map((s, i) => (
            <div key={i} className="p-6 rounded-[30px] bg-white/5 border border-white/5 flex flex-col items-center justify-center">
              <h2 className={`text-4xl font-black ${s.clr}`}>{s.val}</h2>
              <p className="text-[9px] font-black uppercase opacity-40">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2 p-10 rounded-[40px] bg-white/5 border border-white/10 shadow-2xl">
            <h3 className="text-xl font-black uppercase mb-6 flex items-center gap-3 text-red-500"><AlertTriangle size={24} /> Ranking Ketidakhadiran</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-white/10">
                  <tr>
                    <th className="p-4 text-[10px] font-black uppercase text-center">Rank</th>
                    <th className="p-4 text-[10px] font-black uppercase text-left">Kelas</th>
                    <th className="p-4 text-[10px] font-black uppercase text-center">S/I/A</th>
                    <th className="p-4 text-[10px] font-black uppercase text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {rankingKelas.slice(0, 8).map((k, idx) => (
                    <tr key={idx} className="hover:bg-white/5">
                      <td className="p-4 font-black italic text-3xl text-blue-500 text-center">#{idx + 1}</td>
                      <td className="p-4 font-black uppercase text-lg">{k.nama}</td>
                      <td className="p-4 text-center font-black text-lg text-red-400">{k.s + k.i + k.a}</td>
                      <td className="p-4 text-right">
                        <span className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase ${k.skor > 15 ? 'bg-red-600' : k.skor > 8 ? 'bg-yellow-500 text-gray-900' : 'bg-green-600'}`}>
                          {k.skor > 15 ? 'Bahaya' : k.skor > 8 ? 'Waspada' : 'Aman'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col gap-10">
            <div className="p-10 rounded-[40px] bg-white/5 border border-white/10 flex flex-col items-center">
               <h3 className="text-[10px] font-black uppercase tracking-widest mb-4 opacity-50">Sebaran Harian</h3>
               <div className="w-full h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart><Pie data={chartData} innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={5}>{chartData.map((entry, index) => <Cell key={index} fill={COLORS[entry.name]} />)}</Pie><Tooltip/></PieChart>
                </ResponsiveContainer>
               </div>
            </div>
            <div className="bg-blue-600 p-10 rounded-[40px] shadow-2xl text-white relative overflow-hidden h-[250px] flex flex-col justify-center border-4 border-white/10">
               <Trophy className="absolute -right-10 -bottom-10 opacity-10 rotate-12" size={180} />
               <h3 className="text-[10px] font-black uppercase tracking-widest mb-4 text-blue-200">⭐ Siswa Teladan ⭐</h3>
               {siswaRajin.length > 0 ? (
                 <div>
                   <h2 className="text-4xl font-black uppercase leading-tight italic tracking-tighter mb-2">{siswaRajin[currentSiswaIdx]?.nama}</h2>
                   <p className="text-sm font-black text-blue-100 uppercase">{siswaRajin[currentSiswaIdx]?.kelas}</p>
                 </div>
               ) : <p className="opacity-50">Menghitung Data...</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicMonitoring;
