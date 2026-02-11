import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { 
  TrendingUp, AlertTriangle, Users, ShieldCheck, 
  Loader2, Sun, Moon, CheckCircle, Info, Clock, BarChart3, Filter, 
  Calendar, Download, Building, ArrowRight, Search, Trophy, Sparkles
} from 'lucide-react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import * as XLSX from 'xlsx';

const ExecutiveDashboard = ({ user }) => {
  const [activeTab, setActiveTab] = useState('monitoring');
  const [darkMode, setDarkMode] = useState(true);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ Hadir: 0, Sakit: 0, Izin: 0, Alpha: 0, Kesiangan: 0, Total: 0 });
  
  const tahunIni = new Date().getFullYear();
  // Fungsi WIB yang konsisten untuk filter
  const getTodayDateWIB = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
  
  const [filterTanggalMonitoring, setFilterTanggalMonitoring] = useState(getTodayDateWIB());
  const [modeAkumulasi, setModeAkumulasi] = useState('bulan'); 
  const [dariTgl, setDariTgl] = useState('');
  const [sampaiTgl, setSampaiTgl] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [filterJurusan, setFilterJurusan] = useState('Semua');
  const [filterKelas, setFilterKelas] = useState('Semua');
  const [filterBulan, setFilterBulan] = useState(new Date().getMonth() + 1);
  const [masterJurusan, setMasterJurusan] = useState([]);
  const [daftarKelas, setDaftarKelas] = useState([]);
  const [warningWalas, setWarningWalas] = useState([]);
  const [rankingKelas, setRankingKelas] = useState([]);
  const [ewsSiswa, setEwsSiswa] = useState([]);
  const [dataAkumulasi, setDataAkumulasi] = useState([]);
  const [weeklyStats, setWeeklyStats] = useState({ topLateSiswa: [], goldenClass: null });

  const userRole = user?.role?.toLowerCase();
  const isKaprog = userRole === 'kaprog';
  const isGlobalAccess = ['kepsek', 'kesiswaan', 'admin'].includes(userRole);

  useEffect(() => { fetchInitialData(); }, []);
  useEffect(() => { fetchExecutiveData(); }, [filterKelas, filterBulan, filterJurusan, filterTanggalMonitoring, modeAkumulasi, dariTgl, sampaiTgl, activeTab]);

  const fetchInitialData = async () => {
    try {
      const { data: jurs } = await supabase.from('master_jurusan').select('*').order('nama_jurusan');
      setMasterJurusan(jurs || []);
    } catch (e) { console.error(e); }
  };

  const fetchExecutiveData = async () => {
    try {
      setLoading(true);
      
      let tglAwal, tglAkhir;
      if (modeAkumulasi === 'hari') {
        tglAwal = getTodayDateWIB();
        tglAkhir = getTodayDateWIB();
      } else if (modeAkumulasi === 'custom') {
        tglAwal = dariTgl || getTodayDateWIB();
        tglAkhir = sampaiTgl || getTodayDateWIB();
      } else {
        tglAwal = `${tahunIni}-${String(filterBulan).padStart(2, '0')}-01`;
        const lastDay = new Date(tahunIni, filterBulan, 0).getDate();
        tglAkhir = `${tahunIni}-${String(filterBulan).padStart(2, '0')}-${lastDay}`;
      }

      // 1. QUERY MASTER KELAS
      let queryKelas = supabase.from('master_kelas').select('id, nama_kelas, jurusan_id');
      if (isKaprog) queryKelas = queryKelas.eq('jurusan_id', parseInt(user?.jurusan_id || 0));
      else if (isGlobalAccess && filterJurusan !== 'Semua') queryKelas = queryKelas.eq('jurusan_id', parseInt(filterJurusan));
      const { data: mKelas } = await queryKelas.order('nama_kelas');
      setDaftarKelas(mKelas || []);
      const listKelasIds = (mKelas || []).map(k => k.id);

      // 2. DATA SISWA & ABSENSI (Fix: Ambil Semua Siswa Dulu)
      const { data: dataSiswa } = await supabase.from('siswa').select('id, nama_siswa, kelas_id, master_kelas(nama_kelas)').eq('status_siswa', 'Aktif');
      const { data: allWalas } = await supabase.from('walikelas').select('nama_lengkap, kelas_id');
      const siswaTerfilter = (dataSiswa || []).filter(s => listKelasIds.includes(s.kelas_id));

      const { data: dataAbsenHarian } = await supabase.from('absensi').select('*').eq('tanggal', filterTanggalMonitoring);
      
      // Ambil data range (Senin-Jumat)
      const { data: dataAbsenRange } = await supabase.from('absensi')
        .select('status, siswa_id')
        .gte('tanggal', tglAwal)
        .lte('tanggal', tglAkhir);

      // --- LOGIKA MONITORING ---
      const targetSiswaIdsMon = (filterKelas === 'Semua') ? siswaTerfilter.map(s => s.id) : siswaTerfilter.filter(s => s.kelas_id === parseInt(filterKelas)).map(s => s.id);
      const harianFinal = (dataAbsenHarian || []).filter(a => targetSiswaIdsMon.includes(a.siswa_id));
      const counts = { Hadir: 0, Sakit: 0, Izin: 0, Alpha: 0, Kesiangan: 0 };
      harianFinal.forEach(a => { if(counts.hasOwnProperty(a.status)) counts[a.status]++ });
      setStats({ ...counts, Total: targetSiswaIdsMon.length });

      setWarningWalas((mKelas || []).map(k => ({
        nama: k.nama_kelas,
        walas: (allWalas || []).find(w => w.kelas_id === k.id)?.nama_lengkap || 'Belum Diatur',
        status: (dataAbsenHarian || []).some(a => (dataSiswa || []).filter(s => s.kelas_id === k.id).map(s => s.id).includes(a.siswa_id))
      })).filter(k => !k.status));

      setRankingKelas((mKelas || []).map(k => ({
        nama: k.nama_kelas,
        masalah: (dataAbsenHarian || []).filter(a => (dataSiswa || []).filter(s => s.kelas_id === k.id).map(s => s.id).includes(a.siswa_id) && ['Alpha', 'Kesiangan'].includes(a.status)).length
      })).sort((a, b) => b.masalah - a.masalah).slice(0, 8));

      // --- AKUMULASI (FIX DATA HILANG) ---
      const rekapAkumulasiRaw = siswaTerfilter.map(s => {
        // Cari semua absen siswa ini di range tanggal terpilih
        const absenSiswa = (dataAbsenRange || []).filter(a => a.siswa_id === s.id);
        const h = absenSiswa.filter(a => a.status === 'Hadir').length;
        const s_ = absenSiswa.filter(a => a.status === 'Sakit').length;
        const i = absenSiswa.filter(a => a.status === 'Izin').length;
        const a = absenSiswa.filter(a => a.status === 'Alpha').length;
        const k = absenSiswa.filter(a => a.status === 'Kesiangan').length;
        
        return { 
          nama: s.nama_siswa, 
          kelas: s.master_kelas?.nama_kelas || '---', 
          kelas_id: s.kelas_id,
          hadir: h, sakit: s_, izin: i, alpha: a, telat: k, 
          total: h + s_ + i + a + k // Ini akan menunjukkan berapa kali dia diabsen dalam 5 hari
        };
      });

      setDataAkumulasi((filterKelas === 'Semua' ? rekapAkumulasiRaw : rekapAkumulasiRaw.filter(r => r.kelas_id === parseInt(filterKelas))).sort((a, b) => a.nama.localeCompare(b.nama)));
      setEwsSiswa(rekapAkumulasiRaw.filter(s => s.alpha > 2 || s.telat > 3).sort((a, b) => b.alpha - a.alpha));

      // --- WEEKLY INSIGHT ---
      if (activeTab === 'weekly') {
        const tgl7HariLalu = new Date();
        tgl7HariLalu.setDate(tgl7HariLalu.getDate() - 7);
        const format7HariLalu = tgl7HariLalu.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
        
        const { data: rawWeekly } = await supabase.from('absensi').select('status, siswa_id, siswa!inner(nama_siswa, kelas_id, master_kelas(nama_kelas))').gte('tanggal', format7HariLalu);
        
        const lateMap = {};
        rawWeekly?.filter(a => a.status === 'Kesiangan' && targetSiswaIdsMon.includes(a.siswa_id)).forEach(a => {
          const n = a.siswa.nama_siswa;
          if(!lateMap[n]) lateMap[n] = { nama: n, kelas: a.siswa.master_kelas?.nama_kelas, count: 0 };
          lateMap[n].count++;
        });
        
        const classScore = {};
        (mKelas || []).forEach(k => classScore[k.id] = { nama: k.nama_kelas, hadir: 0, total: 0 });
        rawWeekly?.forEach(a => {
          const kid = a.siswa.kelas_id;
          if(classScore[kid]) { 
             classScore[kid].total++; 
             if(a.status === 'Hadir') classScore[kid].hadir++; 
          }
        });
        const sortedClass = Object.values(classScore).filter(c => c.total > 0).map(c => ({ ...c, ratio: (c.hadir / c.total) * 100 })).sort((a, b) => b.ratio - a.ratio);
        setWeeklyStats({ topLateSiswa: Object.values(lateMap).sort((a, b) => b.count - a.count), goldenClass: sortedClass[0] });
      }

    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const filteredDataAkumulasi = dataAkumulasi.filter(item => 
    item.nama.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const exportExcelAkumulasi = () => {
    const dataExcel = (activeTab === 'weekly' ? weeklyStats.topLateSiswa : filteredDataAkumulasi).map(d => ({ 
      "Nama Siswa": d.nama, 
      "Kelas": d.kelas, 
      "Hadir": d.hadir || 0,
      "Sakit": d.sakit || 0,
      "Izin": d.izin || 0,
      "Alpha": d.alpha || 0,
      "Telat": d.telat || 0,
      "Total Hari Terabsen": d.total || 0 
    }));
    const ws = XLSX.utils.json_to_sheet(dataExcel);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rekap");
    XLSX.writeFile(wb, `Rekap_Detail_${getTodayDateWIB()}.xlsx`);
  };

  if (loading) return <div className="h-screen bg-gray-950 flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={40} /></div>;

  return (
    <div className={`min-h-screen transition-all duration-500 ${darkMode ? 'bg-gray-950 text-white' : 'bg-gray-50 text-gray-900'}`}>
      <div className="max-w-7xl mx-auto p-6 pb-20 text-left">
        
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10 text-left">
          <div className="flex flex-col gap-2">
             <div className="flex items-center gap-4 bg-white/5 p-1 rounded-2xl border border-white/10 w-fit">
                <button onClick={() => setActiveTab('monitoring')} className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${activeTab === 'monitoring' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400'}`}>Monitoring</button>
                <button onClick={() => setActiveTab('weekly')} className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${activeTab === 'weekly' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400'}`}>Weekly</button>
                <button onClick={() => setActiveTab('akumulasi')} className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${activeTab === 'akumulasi' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400'}`}>Akumulasi</button>
             </div>
             <h1 className="text-3xl font-black italic uppercase tracking-tighter mt-2">{activeTab === 'weekly' ? 'Jumat Insight' : activeTab === 'akumulasi' ? 'Rekap Akumulasi' : 'Radar Control'}</h1>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {isGlobalAccess && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-2xl border border-white/10 bg-white/5">
                <Building size={14} className="text-blue-500" />
                <select value={filterJurusan} onChange={(e) => { setFilterJurusan(e.target.value); setFilterKelas('Semua'); }} className="bg-transparent outline-none text-[10px] font-black uppercase cursor-pointer">
                  <option value="Semua" className="text-black">SEMUA JURUSAN</option>
                  {masterJurusan.map(j => <option key={j.id} value={j.id} className="text-black">{j.kode_jurusan || j.nama_jurusan}</option>)}
                </select>
              </div>
            )}
            <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl border border-white/10 bg-white/5 ${activeTab !== 'monitoring' ? 'hidden' : ''}`}>
              <Calendar size={14} className="text-blue-500" />
              <input type="date" value={filterTanggalMonitoring} onChange={(e) => setFilterTanggalMonitoring(e.target.value)} className="bg-transparent outline-none text-[10px] font-black uppercase cursor-pointer" />
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl border border-white/10 bg-white/5">
              <Filter size={14} className="text-blue-500" />
              <select value={filterKelas} onChange={(e) => setFilterKelas(e.target.value)} className="bg-transparent outline-none text-[10px] font-black uppercase cursor-pointer">
                <option value="Semua" className="text-black">SEMUA KELAS</option>
                {daftarKelas.map(k => <option key={k.id} value={k.id} className="text-black">{k.nama_kelas}</option>)}
              </select>
            </div>
            <button onClick={() => setDarkMode(!darkMode)} className="p-3 bg-white/5 border border-white/10 rounded-2xl transition-all hover:bg-white/10">
              {darkMode ? <Sun size={20} className="text-yellow-400"/> : <Moon size={20}/>}
            </button>
          </div>
        </header>

        {activeTab === 'monitoring' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
              {[
                { l: 'Siswa', v: stats.Total, c: 'text-blue-500', i: <Users size={20}/> },
                { l: 'Hadir', v: stats.Hadir, c: 'text-green-500', i: <CheckCircle size={20}/> },
                { l: 'Sakit', v: stats.Sakit, c: 'text-orange-500', i: <Info size={20}/> },
                { l: 'Izin', v: stats.Izin, c: 'text-blue-400', i: <Clock size={20}/> },
                { l: 'Alpha', v: stats.Alpha, c: 'text-red-500', i: <AlertTriangle size={20}/> },
                { l: 'Telat', v: stats.Kesiangan, c: 'text-yellow-500', i: <Clock size={20}/> },
              ].map((x, i) => (
                <div key={i} className="p-6 rounded-[30px] border border-white/10 bg-white/5 text-center">
                  <div className={`${x.c} flex justify-center mb-3`}>{x.i}</div>
                  <h3 className="text-3xl font-black mb-2 leading-none">{x.v}</h3>
                  <p className="text-[9px] uppercase font-black opacity-40 tracking-widest">{x.l}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
               <div className="lg:col-span-2 p-8 rounded-[45px] bg-white/5 border border-white/10">
                 <h3 className="text-[10px] font-black uppercase mb-6 text-blue-500 flex items-center gap-2 italic tracking-widest"><BarChart3 size={16} /> Radar Kedisiplinan</h3>
                 <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={rankingKelas}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff10" />
                        <XAxis dataKey="nama" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 'bold' }} />
                        <Tooltip cursor={{ fill: '#ffffff05' }} contentStyle={{backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '15px'}} />
                        <Bar dataKey="masalah" radius={[6, 6, 0, 0]} barSize={25}>
                          {rankingKelas.map((e, idx) => <Cell key={idx} fill={e.masalah > 5 ? '#ef4444' : e.masalah > 2 ? '#f59e0b' : '#3b82f6'} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                 </div>
               </div>
               <div className="p-8 rounded-[45px] bg-red-500/5 border border-red-500/20 max-h-[410px] overflow-y-auto">
                 <h3 className="text-[10px] font-black uppercase mb-6 text-red-500 flex items-center gap-2 italic tracking-widest"><AlertTriangle size={16} /> Belum Absen</h3>
                 <div className="space-y-3">
                   {warningWalas.length === 0 ? <p className="text-[10px] font-bold opacity-30 italic text-center py-10">Semua kelas sudah absen 🌿</p> : warningWalas.map((w, i) => (
                     <div key={i} className="p-4 rounded-2xl bg-white/5 flex justify-between items-center border border-white/5">
                       <div className="text-left"><p className="text-[10px] font-black uppercase leading-tight">{w.nama}</p><p className="text-[8px] font-bold opacity-40 uppercase mt-1 italic">{w.walas}</p></div>
                       <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping"></div>
                     </div>
                   ))}
                 </div>
               </div>
               <div className="lg:col-span-3 p-8 rounded-[45px] bg-white/5 border border-white/10">
                 <div className="flex justify-between items-center mb-8">
                   <div className="flex items-center gap-3">
                     <div className="p-2 bg-red-500/20 rounded-xl text-red-500"><AlertTriangle size={20}/></div>
                     <div className="text-left"><h3 className="text-[10px] font-black uppercase tracking-widest text-red-500">Target Pembinaan Siswa</h3><p className="text-[8px] font-bold opacity-40 uppercase mt-1 italic tracking-widest">Siswa Alpha {'>'} 2 atau Telat {'>'} 3 (Bulan Ini)</p></div>
                   </div>
                   <select value={filterBulan} onChange={(e) => setFilterBulan(parseInt(e.target.value))} className="bg-white/10 px-4 py-2 rounded-xl text-[10px] font-black uppercase border-none outline-none text-white border border-white/10 cursor-pointer">
                     {["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"].map((m, i) => <option key={i} value={i+1} className="text-black">{m}</option>)}
                   </select>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                   {ewsSiswa.length === 0 ? <div className="col-span-4 py-10 text-center opacity-30 font-black italic uppercase text-xs">Siswa terpantau disiplin 🌿</div> : ewsSiswa.map((s, i) => (
                     <div key={i} className="p-5 rounded-[25px] bg-white/5 border border-white/5 hover:bg-white/10 transition-all flex flex-col">
                       <div className="flex gap-1 mb-3">{s.alpha > 2 && <span className="px-2 py-1 bg-red-600 text-white text-[8px] font-black rounded-md">{s.alpha} Alpha</span>}{s.telat > 3 && <span className="px-2 py-1 bg-yellow-500 text-white text-[8px] font-black rounded-md">{s.telat} Telat</span>}</div>
                       <p className="text-[10px] font-black uppercase leading-tight">{s.nama}</p><p className="text-[7px] font-bold opacity-30 mt-1 uppercase tracking-widest italic">{s.kelas}</p>
                     </div>
                   ))}
                 </div>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'weekly' && (
          <div className="space-y-6 animate-in fade-in duration-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="p-10 rounded-[50px] bg-indigo-600 shadow-2xl text-white relative overflow-hidden flex flex-col justify-between min-h-[300px]">
                 <Trophy className="absolute -right-10 -top-10 opacity-10 rotate-12" size={240} />
                 <div className="relative z-10">
                   <div className="flex items-center gap-2 mb-6"><Sparkles size={20} className="text-indigo-200" /><h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-100">The Golden Class</h3></div>
                   {weeklyStats.goldenClass ? (
                     <div className="text-left"><h2 className="text-6xl font-black italic uppercase tracking-tighter leading-none mb-4">{weeklyStats.goldenClass.nama}</h2><p className="text-[11px] font-bold text-indigo-100 uppercase opacity-80">Efektivitas Kehadiran: {weeklyStats.goldenClass.ratio.toFixed(1)}%</p></div>
                   ) : <p className="opacity-50">Mengolah Data...</p>}
                 </div>
                 <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40 text-left">Analysis: Last 7 Days</p>
               </div>
               <div className="p-10 rounded-[50px] bg-white/5 border border-white/10 shadow-xl flex flex-col justify-between text-left">
                  <div className="flex justify-between items-start mb-8 text-left">
                    <div className="text-left"><h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-500 mb-2">Weekly Late Radar</h3><p className="text-[8px] font-bold text-gray-500 uppercase italic">Siswa Terdeteksi Terlambat</p></div>
                    <Clock className="text-blue-500" size={24} />
                  </div>
                  <div className="space-y-3 overflow-y-auto max-h-[180px] pr-2 text-left">
                    {weeklyStats.topLateSiswa.length === 0 ? <p className="text-center opacity-30 italic py-10 font-bold text-xs uppercase">Zero Late Record 🌿</p> : weeklyStats.topLateSiswa.map((s, idx) => (
                      <div key={idx} className="flex justify-between items-center p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all text-left">
                        <div className="text-left"><p className="text-[10px] font-black uppercase text-left">{s.nama}</p><p className="text-[8px] font-bold opacity-30 uppercase text-left">{s.kelas}</p></div>
                        <div className="bg-amber-500/10 text-amber-500 px-3 py-1 rounded-xl font-black text-[9px] uppercase tracking-widest">{s.count} Kali</div>
                      </div>
                    ))}
                  </div>
               </div>
            </div>
            <div className="p-8 rounded-[45px] bg-green-500/5 border border-green-500/10 flex items-center justify-between text-left">
               <div className="text-left"><h4 className="text-lg font-black italic uppercase text-green-500">Resume Laporan Mingguan</h4><p className="text-[10px] font-bold text-gray-500 uppercase mt-1">Export data mingguan ke format Excel.</p></div>
               <button onClick={exportExcelAkumulasi} className="bg-green-600 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg hover:scale-105 transition-all flex items-center gap-2"><Download size={16} /> Export Weekly</button>
            </div>
          </div>
        )}

        {activeTab === 'akumulasi' && (
          <div className="bg-white/5 p-8 rounded-[45px] border border-white/10 shadow-xl animate-in fade-in duration-500 text-left">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-6 text-left">
               <div className="text-left"><h3 className="text-[10px] font-black uppercase tracking-widest text-blue-500 text-left">Tabel Rekap Akumulasi</h3><p className="text-[8px] font-bold opacity-40 uppercase mt-1 italic tracking-widest text-left">Mode: {modeAkumulasi.toUpperCase()}</p></div>
               <div className="flex-1 max-w-sm w-full"><div className="relative flex items-center bg-white/10 rounded-2xl border border-white/10 px-4 py-2 group focus-within:border-blue-500 transition-all"><Search size={14} className="text-gray-500 group-focus-within:text-blue-500" /><input type="text" placeholder="Cari nama siswa..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-transparent outline-none w-full ml-3 text-[10px] font-black uppercase text-white placeholder:text-gray-600" /></div></div>
               <div className="flex flex-wrap items-center gap-2">
                  <select value={modeAkumulasi} onChange={(e) => setModeAkumulasi(e.target.value)} className="bg-white/10 px-4 py-2 rounded-xl text-[9px] font-black uppercase outline-none text-white border border-white/10 cursor-pointer text-left"><option value="bulan" className="text-black">BULAN INI</option><option value="hari" className="text-black">HARI INI</option><option value="custom" className="text-black">POSTING DATE</option></select>
                  {modeAkumulasi === 'bulan' && (<select value={filterBulan} onChange={(e) => setFilterBulan(parseInt(e.target.value))} className="bg-white/10 px-4 py-2 rounded-xl text-[9px] font-black uppercase outline-none text-white border border-white/10 cursor-pointer">{["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"].map((m, i) => <option key={i} value={i+1} className="text-black">{m}</option>)}</select>)}
                  {modeAkumulasi === 'custom' && (<div className="flex items-center gap-2 bg-white/10 px-3 py-2 rounded-xl border border-white/10 text-left"><input type="date" value={dariTgl} onChange={(e) => setDariTgl(e.target.value)} className="bg-transparent outline-none text-[9px] font-black text-white" /><ArrowRight size={12} className="opacity-30" /><input type="date" value={sampaiTgl} onChange={(e) => setSampaiTgl(e.target.value)} className="bg-transparent outline-none text-[9px] font-black text-white" /></div>)}
                  <button onClick={exportExcelAkumulasi} className="bg-green-600 text-white px-6 py-2 rounded-xl font-black text-[9px] uppercase shadow-lg hover:scale-105 transition-all flex items-center gap-2"><Download size={14} /> Export</button>
               </div>
            </div>
            <div className="overflow-x-auto text-left">
               <table className="w-full text-left">
                 <thead className="text-gray-500 uppercase border-b border-white/10 text-[9px] font-black tracking-widest italic">
                   <tr><th className="pb-4">Nama Siswa</th><th className="pb-4 text-center">Kelas</th><th className="pb-4 text-center text-green-500">H</th><th className="pb-4 text-center text-orange-500">S</th><th className="pb-4 text-center text-blue-500">I</th><th className="pb-4 text-center text-red-500">A</th><th className="pb-4 text-center text-yellow-500 italic">T</th><th className="pb-4 text-center">Total</th></tr>
                 </thead>
                 <tbody className="text-[11px] font-bold text-left uppercase">
                   {filteredDataAkumulasi.length === 0 ? (<tr><td colSpan="8" className="py-20 text-center opacity-30 italic font-black text-xs">Data tidak ditemukan 🌿</td></tr>) : filteredDataAkumulasi.map((r, i) => (<tr key={i} className="border-b border-white/5 hover:bg-white/10 transition-all"><td className="py-4 text-left uppercase">{r.nama}</td><td className="text-center opacity-40 font-black">{r.kelas}</td><td className="text-center text-green-500">{r.hadir}</td><td className="text-center text-orange-500">{r.sakit}</td><td className="text-center text-blue-500">{r.izin}</td><td className="text-center text-red-500">{r.alpha}</td><td className="text-center text-yellow-500 italic">{r.telat}</td><td className="text-center font-black italic">{r.total}</td></tr>))}
                 </tbody>
               </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExecutiveDashboard;