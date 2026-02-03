import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { 
  Users, AlertCircle, Clock, CheckCircle, 
  Filter, Printer, Loader2, TrendingUp, Info
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const PiketDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ hadir: 0, terlambat: 0, sakit: 0, izin: 0, alpha: 0, totalSiswa: 0 });
  const [monitoringKelas, setMonitoringKelas] = useState([]);
  const [recentLogs, setRecentLogs] = useState([]);
  const [filterKelas, setFilterKelas] = useState('Semua');
  const [daftarKelas, setDaftarKelas] = useState([]);

  // TIMEZONE INDONESIA GMT+7
  const getTodayDateWIB = () => {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
  };

  useEffect(() => {
    fetchPiketData();
  }, [filterKelas]);

  const fetchPiketData = async () => {
    try {
      setLoading(true);
      const hariIni = getTodayDateWIB();

      // 1. AMBIL MASTER KELAS (Tanpa Join yang bikin data hilang)
      const { data: listKelasMaster } = await supabase
        .from('master_kelas')
        .select('id, nama_kelas')
        .order('nama_kelas', { ascending: true });
      setDaftarKelas(listKelasMaster || []);

      // 2. AMBIL DATA WALIKELAS (Copy logika dari ExecutiveDashboard)
      const { data: allWalas } = await supabase.from('walikelas').select('nama_lengkap, kelas_id');

      // 3. QUERY TOTAL SISWA
      const { data: siswaData, count: totalSiswaCount } = await supabase
        .from('siswa')
        .select('id, kelas_id', { count: 'exact' })
        .eq('status_siswa', 'Aktif');
        
      const totalSiswaPerKelas = {};
      siswaData?.forEach(s => {
        totalSiswaPerKelas[s.kelas_id] = (totalSiswaPerKelas[s.kelas_id] || 0) + 1;
      });

      // 4. QUERY ABSENSI HARI INI
      let queryAbsen = supabase
        .from('absensi')
        .select('status, siswa!inner(kelas_id)')
        .eq('tanggal', hariIni);

      if (filterKelas !== 'Semua') {
        queryAbsen = queryAbsen.eq('siswa.kelas_id', parseInt(filterKelas));
      }
      const { data: dataAbsen } = await queryAbsen;

      const counts = { Hadir: 0, Sakit: 0, Izin: 0, Alpha: 0, Kesiangan: 0 };
      dataAbsen?.forEach(a => { if(counts.hasOwnProperty(a.status)) counts[a.status]++ });
      
      setStats({
        hadir: counts.Hadir,
        terlambat: counts.Kesiangan,
        sakit: counts.Sakit,
        izin: counts.Izin,
        alpha: counts.Alpha,
        totalSiswa: totalSiswaCount || 0
      });

      // 5. MONITORING KELAS (Mapping Nama Walas)
      const statusPerKelas = (listKelasMaster || []).map(k => {
        const jumlahTerabsen = dataAbsen?.filter(d => d.siswa?.kelas_id === k.id).length || 0;
        const totalSiswa = totalSiswaPerKelas[k.id] || 0;
        // Cari nama walikelas berdasarkan kelas_id (Logic dari ExecutiveDashboard)
        const walasFound = allWalas?.find(w => w.kelas_id === k.id)?.nama_lengkap || 'Belum Diatur';
        
        return {
          id: k.id,
          nama: k.nama_kelas,
          walas: walasFound,
          terabsen: jumlahTerabsen,
          total: totalSiswa,
          isComplete: jumlahTerabsen >= totalSiswa && totalSiswa > 0
        };
      });

      // Filter list kelas yang tampil jika ada filter terpilih
      const finalMonitoring = filterKelas === 'Semua' 
        ? statusPerKelas 
        : statusPerKelas.filter(k => k.id === parseInt(filterKelas));
        
      setMonitoringKelas(finalMonitoring);

      // 6. LOG PIKET (Hanya hari ini)
      let queryLog = supabase
        .from('log_piket')
        .select(`*, siswa!inner (nama_siswa, kelas_id, master_kelas (nama_kelas))`)
        .gte('created_at', hariIni)
        .order('created_at', { ascending: false })
        .limit(10);

      if (filterKelas !== 'Semua') {
        queryLog = queryLog.eq('siswa.kelas_id', parseInt(filterKelas));
      }
      
      const { data: logs } = await queryLog;
      setRecentLogs((logs || []).map(l => ({
        ...l,
        siswa_nama: l.siswa?.nama_siswa || 'Siswa',
        siswa_kelas: l.siswa?.master_kelas?.nama_kelas || 'Kelas'
      })));

    } catch (err) {
      console.error("Dashboard Error:", err.message);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = { Hadir: '#10b981', Terlambat: '#facc15', Sakit: '#f59e0b', Izin: '#3b82f6', Alpha: '#ef4444' };
  const chartData = [
    { name: 'Hadir', value: stats.hadir },
    { name: 'Terlambat', value: stats.terlambat },
    { name: 'Sakit', value: stats.sakit },
    { name: 'Izin', value: stats.izin },
    { name: 'Alpha', value: stats.alpha },
  ].filter(d => d.value > 0);

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-40">
      <Loader2 className="animate-spin text-blue-600 mb-4" size={40} />
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Sinkronisasi Control Room...</p>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto p-4 pb-20 font-sans">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 text-gray-800 text-left">
        <div className="text-left">
          <h1 className="text-3xl font-black italic uppercase tracking-tighter leading-none text-left">Piket Control Room</h1>
          <p className="text-[10px] font-bold text-blue-600 tracking-[0.3em] uppercase mt-2 text-left">Live Monitoring Dashboard</p>
        </div>
        
        <div className="flex items-center gap-2 bg-white px-4 py-3 rounded-2xl shadow-sm border border-gray-100 w-full md:w-auto">
          <Filter size={16} className="text-blue-600" />
          <select 
            value={filterKelas}
            onChange={(e) => setFilterKelas(e.target.value)}
            className="text-[10px] font-black uppercase outline-none bg-transparent w-full cursor-pointer text-gray-700"
          >
            <option value="Semua">SELURUH KELAS</option>
            {daftarKelas.map(k => <option key={k.id} value={k.id}>KELAS: {k.nama_kelas}</option>)}
          </select>
        </div>
      </header>

      {/* STATS CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8 text-gray-800">
        <div className="bg-blue-600 p-6 rounded-[35px] text-white shadow-lg flex flex-col items-center">
          <Users size={20} className="mb-2 opacity-50" />
          <h2 className="text-3xl font-black">{stats.totalSiswa}</h2>
          <p className="text-[9px] font-black uppercase tracking-widest opacity-80">Total Siswa</p>
        </div>
        <div className="bg-white p-6 rounded-[35px] border border-gray-100 shadow-sm flex flex-col items-center">
          <CheckCircle size={20} className="text-green-500 mb-2" />
          <h2 className="text-3xl font-black">{stats.hadir}</h2>
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Hadir</p>
        </div>
        <div className="bg-white p-6 rounded-[35px] border border-gray-100 shadow-sm flex flex-col items-center">
          <Clock size={20} className="text-amber-500 mb-2" />
          <h2 className="text-3xl font-black">{stats.terlambat}</h2>
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Telat</p>
        </div>
        <div className="bg-white p-6 rounded-[35px] border border-gray-100 shadow-sm flex flex-col items-center">
          <Info size={20} className="text-orange-500 mb-2" />
          <h2 className="text-3xl font-black">{stats.sakit}</h2>
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Sakit</p>
        </div>
        <div className="bg-white p-6 rounded-[35px] border border-gray-100 shadow-sm flex flex-col items-center">
          <TrendingUp size={20} className="text-blue-600 mb-2" />
          <h2 className="text-3xl font-black">{stats.izin}</h2>
          <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Izin</p>
        </div>
        <div className="bg-red-600 p-6 rounded-[35px] text-white shadow-lg flex flex-col items-center">
          <AlertCircle size={20} className="mb-2 opacity-50" />
          <h2 className="text-3xl font-black">{stats.alpha}</h2>
          <p className="text-[9px] font-black uppercase tracking-widest opacity-80">Alpha</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
        <div className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm flex flex-col items-center h-[300px]">
          <h3 className="text-[10px] font-black text-gray-800 uppercase tracking-[0.2em] mb-6 italic text-center">Komposisi Status</h3>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={chartData} innerRadius={60} outerRadius={80} dataKey="value" paddingAngle={5}>
                {chartData.map((entry, index) => <Cell key={index} fill={COLORS[entry.name]} />)}
              </Pie>
              <Tooltip contentStyle={{borderRadius: '20px', border: 'none', fontWeight: 'bold', fontSize: '10px'}} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="md:col-span-2 bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm text-left">
          <h3 className="text-[10px] font-black uppercase mb-6 flex items-center gap-2 text-gray-400 tracking-widest italic text-left">
            <Clock size={16} className="text-blue-600" /> Monitoring Kehadiran Kelas
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[200px] overflow-y-auto pr-2">
            {monitoringKelas.map((k, i) => (
              <div key={i} className={`p-4 rounded-[25px] border transition-all text-left ${k.isComplete ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                <p className="text-[11px] font-black text-gray-800 truncate mb-1 uppercase text-left">{k.nama}</p>
                <p className="text-[8px] font-black text-blue-500 uppercase truncate mb-1 italic text-left">{k.walas}</p>
                <p className="text-[8px] font-bold text-gray-400 uppercase text-left">{k.terabsen} / {k.total} Siswa</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-gray-900 p-8 rounded-[45px] text-white shadow-2xl text-left">
        <header className="flex justify-between items-center mb-8">
          <h3 className="text-[10px] font-black uppercase flex items-center gap-2 text-blue-400 tracking-widest italic text-left">
            <Printer size={16} /> Aktivitas Meja Piket
          </h3>
          <span className="text-[8px] font-bold bg-white/10 px-3 py-1 rounded-full uppercase italic">Update Real-Time</span>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {recentLogs.length === 0 ? (
            <div className="col-span-5 p-10 text-center text-gray-500 italic text-[10px] uppercase font-bold tracking-widest">
                Tidak ada aktivitas piket untuk hari ini
            </div>
          ) : (
            recentLogs.map((log, i) => (
              <div key={i} className="p-5 bg-white/5 rounded-[30px] border border-white/10 flex flex-col justify-between hover:bg-white/10 transition-all group">
                <div>
                  <p className="text-[10px] font-black uppercase leading-tight mb-1 truncate text-white">{log.siswa_nama}</p>
                  <p className="text-[8px] text-blue-400 font-bold uppercase italic">{log.jenis_log}</p>
                </div>
                <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-end">
                  <p className="text-[8px] font-black text-gray-500 uppercase">{new Date(log.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                  <CheckCircle size={12} className="text-blue-500 opacity-50 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default PiketDashboard;