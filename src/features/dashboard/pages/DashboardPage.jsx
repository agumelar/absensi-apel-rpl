import React, { useCallback, useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { 
  Loader2, Users, CheckCircle, ShieldCheck, 
  BarChart3, Clock, AlertTriangle, School, Settings, ArrowRight, TrendingUp
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Card, { CardContent } from '../../../shared/ui/Card';
import { PageContainer, PageHeader, PageSubtitle, PageTitle } from '../../../shared/ui/PageLayout';
import {
  PEMBIASAAN_ADMIN_SCHEDULE_ROUTE,
  PEMBIASAAN_ADMIN_SETTINGS_ROUTE,
} from '../../../shared/constants/routes';

const Dashboard = ({ user }) => {
  const [dataGrafik, setDataGrafik] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalSiswa: 0, totalUser: 0, totalKelas: 0 });
  const [jumlahTerabsen, setJumlahTerabsen] = useState(0); 
  const [persentaseHadir, setPersentaseHadir] = useState(0);
  const [siswaBermasalah, setSiswaBermasalah] = useState([]);
  const [filterBulan, setFilterBulan] = useState(new Date().getMonth() + 1);

  const isAdmin = user?.role?.toLowerCase() === 'admin';

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const hariIni = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());

      if (isAdmin) {
        const { count: u } = await supabase.from('walikelas').select('*', { count: 'exact', head: true });
        const { count: k } = await supabase.from('master_kelas').select('*', { count: 'exact', head: true });
        const { count: s } = await supabase.from('siswa').select('*', { count: 'exact', head: true }).eq('status_siswa', 'Aktif');
        setStats({ totalUser: u || 0, totalKelas: k || 0, totalSiswa: s || 0 });

      } else {
        const targetKelasId = user?.kelas_id;
        if (!targetKelasId) {
            setLoading(false);
            return;
        }

        const { data: listSiswa } = await supabase.from('siswa').select('id').eq('kelas_id', targetKelasId).eq('status_siswa', 'Aktif');
        const totalSiswaKls = listSiswa?.length || 0;
        setStats(prev => ({ ...prev, totalSiswa: totalSiswaKls }));

        const { data: dataHarian } = await supabase.from('absensi').select(`status, siswa!inner(kelas_id)`).eq('tanggal', hariIni).eq('siswa.kelas_id', targetKelasId);
        const counts = { Hadir: 0, Sakit: 0, Izin: 0, Kesiangan: 0, Alpha: 0 };
        (dataHarian || []).forEach(item => {
          if (Object.prototype.hasOwnProperty.call(counts, item.status)) counts[item.status]++;
        });
        
        setDataGrafik(Object.keys(counts).map(key => ({ name: key, value: counts[key] })).filter(d => d.value > 0));
        setJumlahTerabsen(dataHarian?.length || 0);
        const h = (counts.Hadir || 0) + (counts.Kesiangan || 0);
        setPersentaseHadir(totalSiswaKls > 0 ? (h / totalSiswaKls) * 100 : 0);

        const tahunIni = new Date().getFullYear();
        const awalBulan = `${tahunIni}-${String(filterBulan).padStart(2, '0')}-01`;
        const { data: dataBina } = await supabase.from('absensi').select(`status, siswa!inner(nama_siswa, kelas_id)`).eq('siswa.kelas_id', targetKelasId).gte('tanggal', awalBulan);
        
        const rekapBina = {};
        (dataBina || []).forEach(d => {
          const nama = d.siswa?.nama_siswa;
          if (nama) {
            if (!rekapBina[nama]) rekapBina[nama] = { nama, alpha: 0, kesiangan: 0 };
            if (d.status === 'Alpha') rekapBina[nama].alpha++;
            if (d.status === 'Kesiangan') rekapBina[nama].kesiangan++;
          }
        });
        setSiswaBermasalah(Object.values(rekapBina).filter(s => s.alpha > 2 || s.kesiangan > 3));
      }
    } catch (err) { 
        console.error('Dashboard Error:', err.message); 
    } finally { 
        setLoading(false); 
    }
  }, [filterBulan, isAdmin, user]);

  useEffect(() => {
    if (user) fetchDashboardData();
  }, [fetchDashboardData, user]);

  const kondisi = {
    85: { text: 'SANGAT BAIK', color: 'text-green-600', bg: 'bg-green-50', icon: <CheckCircle className="text-green-500" size={32} /> },
    70: { text: 'WASPADA', color: 'text-orange-500', bg: 'bg-orange-50', icon: <Clock className="text-orange-500" size={32} /> },
    0: { text: 'BUTUH PERHATIAN', color: 'text-red-600', bg: 'bg-red-50', icon: <AlertTriangle className="text-red-500" size={32} /> }
  };
  const currentKondisi = persentaseHadir >= 85 ? kondisi[85] : persentaseHadir >= 70 ? kondisi[70] : kondisi[0];
  const statusBadgeClass = {
    Hadir: 'bg-green-500 text-white',
    Sakit: 'bg-amber-500 text-white',
    Izin: 'bg-blue-600 text-white',
    Kesiangan: 'bg-orange-500 text-white',
    Alpha: 'bg-red-600 text-white',
  };

  if (loading) return <div className="p-40 text-center"><Loader2 className="animate-spin mx-auto text-blue-600" size={40} /></div>;

  if (isAdmin) {
    return (
      <PageContainer className="text-left">
        <PageHeader className="mb-8 block">
          <div className="flex items-center gap-2 text-blue-600 mb-2">
            <Settings size={20} /> <span className="text-[10px] font-black uppercase tracking-[0.4em]">Control Center</span>
          </div>
          <PageTitle className="italic uppercase">System Admin</PageTitle>
        </PageHeader>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <Card className="rounded-3xl"><CardContent className="flex items-center justify-between p-8">
            <div><p className="text-[10px] font-black text-gray-400 uppercase mb-1">Users</p><h2 className="text-4xl font-black text-blue-600">{stats.totalUser}</h2></div>
            <ShieldCheck size={40} className="text-blue-100" />
          </CardContent></Card>
          <Card className="rounded-3xl"><CardContent className="flex items-center justify-between p-8">
            <div><p className="text-[10px] font-black text-gray-400 uppercase mb-1">Kelas</p><h2 className="text-4xl font-black text-blue-600">{stats.totalKelas}</h2></div>
            <School size={40} className="text-blue-100" />
          </CardContent></Card>
          <Card className="rounded-3xl"><CardContent className="flex items-center justify-between p-8">
            <div><p className="text-[10px] font-black text-gray-400 uppercase mb-1">Siswa</p><h2 className="text-4xl font-black text-blue-600">{stats.totalSiswa}</h2></div>
            <Users size={40} className="text-blue-100" />
          </CardContent></Card>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          <Link to="/manajemen-user" className="bg-blue-600 p-6 rounded-[30px] text-white flex justify-between items-center transition-all hover:scale-[1.02]"><span className="font-black uppercase text-xs italic tracking-widest text-left">User Control</span><ArrowRight/></Link>
          <Link to="/manajemen-kelas" className="bg-indigo-600 p-6 rounded-[30px] text-white flex justify-between items-center transition-all hover:scale-[1.02]"><span className="font-black uppercase text-xs italic tracking-widest text-left">Kelas Data</span><ArrowRight/></Link>
          <Link to="/manajemen-siswa" className="bg-violet-600 p-6 rounded-[30px] text-white flex justify-between items-center transition-all hover:scale-[1.02]"><span className="font-black uppercase text-xs italic tracking-widest text-left">Siswa Master</span><ArrowRight/></Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          <Link to={PEMBIASAAN_ADMIN_SCHEDULE_ROUTE} className="bg-emerald-600 p-6 rounded-[30px] text-white flex justify-between items-center transition-all hover:scale-[1.02]"><span className="font-black uppercase text-xs italic tracking-widest text-left">Penjadwalan Sapa Pagi</span><ArrowRight/></Link>
          <Link to={PEMBIASAAN_ADMIN_SETTINGS_ROUTE} className="bg-teal-600 p-6 rounded-[30px] text-white flex justify-between items-center transition-all hover:scale-[1.02]"><span className="font-black uppercase text-xs italic tracking-widest text-left">Pengaturan Pembiasaan</span><ArrowRight/></Link>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="pb-20 text-left">
      <PageHeader className="mb-8 block">
        <PageTitle className="text-4xl md:text-5xl italic uppercase">Visual Analytics</PageTitle>
        <PageSubtitle className="mt-3 italic">Overview kelas {user?.kelas_diampu || 'diampu'} hari ini</PageSubtitle>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-blue-600 p-10 rounded-[45px] text-white shadow-xl shadow-blue-200 flex flex-col justify-between min-h-[260px]">
          <div>
            <Users size={40} className="mb-6 opacity-40" />
            <p className="text-[11px] font-black uppercase opacity-70 tracking-widest">Siswa Terabsen</p>
            <h2 className="text-7xl font-black">{jumlahTerabsen} <span className="text-2xl opacity-40">/ {stats.totalSiswa}</span></h2>
          </div>
          <p className="text-[10px] font-bold italic opacity-60 uppercase tracking-tighter text-left">Sinkronisasi Database</p>
        </div>

        <div className={`${currentKondisi.bg} p-10 rounded-[45px] border border-white flex flex-col justify-between min-h-[260px]`}>
          <div>
            {currentKondisi.icon}
            <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mt-6">Kondisi Kelas</p>
            <h3 className={`text-4xl font-black leading-none mt-2 ${currentKondisi.color}`}>{currentKondisi.text}</h3>
          </div>
          <div>
            <div className="w-full bg-gray-200/50 rounded-full h-2 mb-2">
              <div className={`h-2 rounded-full transition-all duration-1000 ${persentaseHadir >= 70 ? 'bg-green-500' : 'bg-red-500'}`} style={{width: `${persentaseHadir}%`}}></div>
            </div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{persentaseHadir.toFixed(1)}% Kehadiran</p>
          </div>
        </div>

        <div className="bg-white p-10 rounded-[45px] border border-gray-100 shadow-sm flex flex-col justify-between min-h-[260px]">
          <h3 className="font-black text-[11px] uppercase tracking-widest text-gray-400 flex items-center gap-2"><BarChart3 size={16}/> Komposisi Status</h3>
          <div className="h-32 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={dataGrafik} innerRadius={35} outerRadius={50} paddingAngle={5} dataKey="value">
                  {dataGrafik.map((entry, index) => {
                    const colors = { Hadir: '#10b981', Sakit: '#f59e0b', Izin: '#3b82f6', Kesiangan: '#facc15', Alpha: '#ef4444' };
                    return <Cell key={index} fill={colors[entry.name] || '#eee'} />;
                  })}
                </Pie>
                <Tooltip contentStyle={{borderRadius: '20px', border: 'none'}} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-2 overflow-hidden">
             {dataGrafik.map((d, i) => (
               <span
                 key={i}
                 className={`text-[8px] font-black px-2 py-1 rounded-lg uppercase ${statusBadgeClass[d.name] || 'bg-slate-600 text-white'}`}
               >
                 {d.name}
               </span>
              ))}
           </div>
        </div>
      </div>

      <div className="bg-white p-10 rounded-[50px] border border-red-50 shadow-sm text-left">
        <div className="flex justify-between items-center mb-10">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-100 rounded-2xl text-red-600"><AlertTriangle size={24}/></div>
            <div>
              <h3 className="text-xl font-black uppercase tracking-tight text-gray-800 leading-none">Early Warning System</h3>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">Siswa Butuh Perhatian Bulan Ini</p>
            </div>
          </div>
          <select value={filterBulan} onChange={(e) => setFilterBulan(parseInt(e.target.value))} className="bg-gray-50 p-3 rounded-2xl text-[10px] font-black uppercase outline-none border-none cursor-pointer">
            {["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"].map((m, i) => <option key={i} value={i+1} className="text-black">{m}</option>)}
          </select>
        </div>

        {siswaBermasalah.length === 0 ? (
          <div className="text-center py-10 opacity-30 italic font-bold uppercase text-xs">Semua terpantau aman 🌿</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {siswaBermasalah.map((s, idx) => (
              <div key={idx} className="p-6 rounded-[30px] bg-red-50/30 border border-red-50 flex items-center justify-between group hover:bg-red-50 transition-all">
                <div className="text-left">
                  <p className="font-black text-gray-800 text-xs uppercase leading-tight">{s.nama}</p>
                  <p className="text-[8px] font-black text-red-400 uppercase mt-1">Status: Bina Siswa</p>
                </div>
                <div className="flex gap-2">
                  {s.alpha > 0 && <span className="px-3 py-1 bg-red-600 text-white text-[9px] font-black rounded-full">{s.alpha} A</span>}
                  {s.kesiangan > 0 && <span className="px-3 py-1 bg-orange-500 text-white text-[9px] font-black rounded-full">{s.kesiangan} T</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
};

export default Dashboard;
