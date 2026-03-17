import React, { useCallback, useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { 
  TrendingUp, AlertTriangle, Users, ShieldCheck, 
  Loader2, CheckCircle, Info, Clock, BarChart3, Filter, 
  Calendar, Download, Building, ArrowRight, Search, Trophy, Sparkles
} from 'lucide-react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { exportJsonToExcel } from '../../../services/shared/excelService';
import { PageContainer, PageHeader, PageSubtitle, PageTitle } from '../../../shared/ui/PageLayout';

const ExecutiveDashboard = ({ user }) => {
  const [activeTab, setActiveTab] = useState('monitoring');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ Hadir: 0, Sakit: 0, Izin: 0, Alpha: 0, Kesiangan: 0, Total: 0 });
  
  const tahunIni = new Date().getFullYear();
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
  const isGlobalAccess = ['kepsek', 'kesiswaan', 'kurikulum'].includes(userRole);

  useEffect(() => { fetchInitialData(); }, []);

  const fetchInitialData = async () => {
    try {
      const { data: jurs } = await supabase.from('master_jurusan').select('*').order('nama_jurusan');
      setMasterJurusan(jurs || []);
    } catch (e) { console.error(e); }
  };

  // --- FUNGSI SAKTI: MELEWATI LIMIT 1000 BARIS SUPABASE ---
  const fetchAbsensiAll = async (selectQuery, buildQueryFn) => {
    let allData = [];
    let step = 0;
    let isFetching = true;
    while (isFetching) {
      let q = supabase.from('absensi').select(selectQuery);
      q = buildQueryFn(q);
      const { data, error } = await q.range(step * 1000, (step + 1) * 1000 - 1);
      if (error) throw error;
      allData = [...allData, ...(data || [])];
      // Jika hasil kurang dari 1000, berarti data sudah habis
      if (!data || data.length < 1000) isFetching = false;
      step++;
    }
    return allData;
  };

  const fetchExecutiveData = useCallback(async () => {
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

      // 1. QUERY KELAS
      let queryKelas = supabase.from('master_kelas').select('id, nama_kelas, jurusan_id');
      if (isKaprog) queryKelas = queryKelas.eq('jurusan_id', parseInt(user?.jurusan_id || 0));
      else if (isGlobalAccess && filterJurusan !== 'Semua') queryKelas = queryKelas.eq('jurusan_id', parseInt(filterJurusan));
      const { data: mKelas } = await queryKelas.order('nama_kelas');
      setDaftarKelas(mKelas || []);
      const listKelasIds = (mKelas || []).map(k => k.id);

      // 2. QUERY SISWA & WALAS
      const { data: dataSiswa } = await supabase.from('siswa').select('id, nama_siswa, kelas_id, master_kelas(nama_kelas)').eq('status_siswa', 'Aktif');
      const { data: allWalas } = await supabase.from('walikelas').select('nama_lengkap, kelas_id');
      const siswaTerfilter = (dataSiswa || []).filter(s => listKelasIds.includes(s.kelas_id));
      const validSiswaIdsSet = new Set(siswaTerfilter.map(s => s.id));

      // 3. TARIK DATA ABSENSI MENGGUNAKAN FUNGSI SAKTI (TANPA LIMIT)
      const dataAbsenHarian = await fetchAbsensiAll('*', q => q.eq('tanggal', filterTanggalMonitoring));
      const rawDataAbsenRange = await fetchAbsensiAll('status, siswa_id', q => q.gte('tanggal', tglAwal).lte('tanggal', tglAkhir));
      
      // Filter lokal agar lebih aman dan tidak kena limit URL di Supabase
      const dataAbsenRange = rawDataAbsenRange.filter(a => validSiswaIdsSet.has(a.siswa_id));

      // --- MONITORING ---
      const targetSiswaIdsMon = (filterKelas === 'Semua') ? siswaTerfilter.map(s => s.id) : siswaTerfilter.filter(s => s.kelas_id === parseInt(filterKelas)).map(s => s.id);
      const harianFinal = (dataAbsenHarian || []).filter(a => targetSiswaIdsMon.includes(a.siswa_id));
      const counts = { Hadir: 0, Sakit: 0, Izin: 0, Alpha: 0, Kesiangan: 0 };
      harianFinal.forEach(a => {
        if (Object.prototype.hasOwnProperty.call(counts, a.status)) counts[a.status]++;
      });
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

      // --- AKUMULASI ---
      const rekapAkumulasiRaw = siswaTerfilter.map(s => {
        const absenSiswa = dataAbsenRange.filter(a => a.siswa_id === s.id);
        const h = absenSiswa.filter(a => a.status === 'Hadir').length;
        const s_ = absenSiswa.filter(a => a.status === 'Sakit').length;
        const i = absenSiswa.filter(a => a.status === 'Izin').length;
        const a = absenSiswa.filter(a => a.status === 'Alpha').length;
        const k = absenSiswa.filter(a => a.status === 'Kesiangan').length;
        return { 
          nama: s.nama_siswa, kelas: s.master_kelas?.nama_kelas || '---', kelas_id: s.kelas_id,
          hadir: h, sakit: s_, izin: i, alpha: a, telat: k, total: h+s_+i+a+k 
        };
      });

      setDataAkumulasi((filterKelas === 'Semua' ? rekapAkumulasiRaw : rekapAkumulasiRaw.filter(r => r.kelas_id === parseInt(filterKelas))).sort((a, b) => a.nama.localeCompare(b.nama)));
      setEwsSiswa(rekapAkumulasiRaw.filter(s => s.alpha > 2 || s.telat > 3).sort((a, b) => b.alpha - a.alpha));

      // --- WEEKLY ---
      if (activeTab === 'weekly') {
        const tgl7HariLalu = new Date();
        tgl7HariLalu.setDate(tgl7HariLalu.getDate() - 7);
        const format7HariLalu = tgl7HariLalu.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
        
        // Pake fungsi sakti juga di sini biar data radar nggak kepotong
        const rawWeekly = await fetchAbsensiAll('status, siswa_id, siswa!inner(nama_siswa, kelas_id, master_kelas(nama_kelas))', q => q.gte('tanggal', format7HariLalu));
        
        const lateMap = {};
        rawWeekly?.filter(a => a.status === 'Kesiangan' && validSiswaIdsSet.has(a.siswa_id)).forEach(a => {
          const n = a.siswa.nama_siswa;
          if(!lateMap[n]) lateMap[n] = { nama: n, kelas: a.siswa.master_kelas?.nama_kelas, count: 0 };
          lateMap[n].count++;
        });
        
        const classScore = {};
        (mKelas || []).forEach(k => classScore[k.id] = { nama: k.nama_kelas, hadir: 0, total: 0 });
        rawWeekly?.forEach(a => {
          const kid = a.siswa?.kelas_id;
          if(classScore[kid]) { classScore[kid].total++; if(a.status === 'Hadir') classScore[kid].hadir++; }
        });
        
        const sortedClass = Object.values(classScore).filter(c => c.total > 0).map(c => ({ ...c, ratio: (c.hadir / c.total) * 100 })).sort((a, b) => b.ratio - a.ratio);
        setWeeklyStats({ topLateSiswa: Object.values(lateMap).sort((a, b) => b.count - a.count), goldenClass: sortedClass[0] });
      }

    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [
    activeTab,
    dariTgl,
    filterBulan,
    filterJurusan,
    filterKelas,
    filterTanggalMonitoring,
    isGlobalAccess,
    isKaprog,
    modeAkumulasi,
    sampaiTgl,
    tahunIni,
    user?.jurusan_id,
  ]);

  useEffect(() => { fetchExecutiveData(); }, [fetchExecutiveData]);

  const filteredDataAkumulasi = dataAkumulasi.filter(item => 
    item.nama.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const exportExcelAkumulasi = () => {
    const dataExcel = (activeTab === 'weekly' ? weeklyStats.topLateSiswa : filteredDataAkumulasi).map(d => ({ 
      "Nama Siswa": d.nama, 
      "Kelas": d.kelas, 
      "H": d.hadir || 0,
      "S": d.sakit || 0,
      "I": d.izin || 0,
      "A": d.alpha || 0,
      "T": d.telat || 0,
      "Total": d.total || d.count || 0 
    }));
    exportJsonToExcel({
      rows: dataExcel,
      sheetName: 'Rekap',
      fileName: `Rekap_${activeTab}_${getTodayDateWIB()}.xlsx`,
    });
  };

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={40} /></div>;

  return (
    <PageContainer className="max-w-7xl pb-20">
      <div className="min-h-screen transition-all duration-500">
        <PageHeader className="mb-8">
          <div className="flex flex-col gap-2">
             <div className="flex items-center gap-4 bg-white/5 p-1 rounded-2xl border border-white/10 w-fit">
                <button onClick={() => setActiveTab('monitoring')} className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${activeTab === 'monitoring' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>Monitoring</button>
                <button onClick={() => setActiveTab('weekly')} className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${activeTab === 'weekly' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>Weekly</button>
                <button onClick={() => setActiveTab('akumulasi')} className={`px-6 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${activeTab === 'akumulasi' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>Akumulasi</button>
             </div>
             <PageTitle className="mt-2 text-3xl italic uppercase">
               {activeTab === 'weekly' ? 'Jumat Insight' : activeTab === 'akumulasi' ? 'Rekap Akumulasi' : 'Radar Control'}
             </PageTitle>
             <PageSubtitle>Executive Visibility</PageSubtitle>
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
          </div>
        </PageHeader>

        {activeTab === 'monitoring' && (
          <div className="space-y-6 animate-in fade-in duration-500 text-left">
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left">
               <div className="lg:col-span-2 p-8 rounded-[45px] bg-white/5 border border-white/10 text-left">
                 <h3 className="text-[10px] font-black uppercase mb-6 text-blue-500 flex items-center gap-2 italic tracking-widest text-left"><BarChart3 size={16} /> Radar Kedisiplinan</h3>
                 <div className="h-[300px] w-full text-left">
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
               <div className="p-8 rounded-[45px] bg-red-500/5 border border-red-500/20 max-h-[410px] overflow-y-auto text-left">
                 <h3 className="text-[10px] font-black uppercase mb-6 text-red-500 flex items-center gap-2 italic tracking-widest text-left"><AlertTriangle size={16} /> Belum Absen</h3>
                 <div className="space-y-3 text-left">
                   {warningWalas.length === 0 ? <p className="text-[10px] font-bold opacity-30 italic text-center py-10 text-left">Semua kelas sudah absen 🌿</p> : warningWalas.map((w, i) => (
                     <div key={i} className="p-4 rounded-2xl bg-white/5 flex justify-between items-center border border-white/5 text-left">
                       <div className="text-left text-left"><p className="text-[10px] font-black uppercase leading-tight text-left">{w.nama}</p><p className="text-[8px] font-bold opacity-40 uppercase mt-1 italic text-left">{w.walas}</p></div>
                       <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping"></div>
                     </div>
                   ))}
                 </div>
               </div>
               <div className="lg:col-span-3 p-8 rounded-[45px] bg-white/5 border border-white/10 text-left">
                 <div className="flex justify-between items-center mb-8 text-left">
                   <div className="flex items-center gap-3 text-left">
                     <div className="p-2 bg-red-500/20 rounded-xl text-red-500 text-left"><AlertTriangle size={20}/></div>
                     <div className="text-left text-left"><h3 className="text-[10px] font-black uppercase tracking-widest text-red-500 text-left">Target Pembinaan Siswa</h3><p className="text-[8px] font-bold opacity-40 uppercase mt-1 italic tracking-widest text-left text-left">Siswa Alpha {'>'} 2 atau Telat {'>'} 3 (Bulan Ini)</p></div>
                   </div>
                   <select value={filterBulan} onChange={(e) => setFilterBulan(parseInt(e.target.value))} className="bg-white/10 px-4 py-2 rounded-xl text-[10px] font-black uppercase border-none outline-none text-white border border-white/10 cursor-pointer text-left">
                     {["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"].map((m, i) => <option key={i} value={i+1} className="text-black text-left">{m}</option>)}
                   </select>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-left">
                   {ewsSiswa.length === 0 ? <div className="col-span-4 py-10 text-center opacity-30 font-black italic uppercase text-xs text-left">Siswa terpantau disiplin 🌿</div> : ewsSiswa.map((s, i) => (
                     <div key={i} className="p-5 rounded-[25px] bg-white/5 border border-white/5 hover:bg-white/10 transition-all flex flex-col text-left">
                       <div className="flex gap-1 mb-3 text-left">{s.alpha > 2 && <span className="px-2 py-1 bg-red-600 text-white text-[8px] font-black rounded-md text-left">{s.alpha} Alpha</span>}{s.telat > 3 && <span className="px-2 py-1 bg-yellow-500 text-white text-[8px] font-black rounded-md text-left">{s.telat} Telat</span>}</div>
                       <p className="text-[10px] font-black uppercase leading-tight text-left text-left">{s.nama}</p><p className="text-[7px] font-bold opacity-30 mt-1 uppercase tracking-widest italic text-left text-left">{s.kelas}</p>
                     </div>
                   ))}
                 </div>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'weekly' && (
          <div className="space-y-6 animate-in fade-in duration-700 text-left">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
               <div className="p-10 rounded-[50px] bg-indigo-600 shadow-2xl text-white relative overflow-hidden flex flex-col justify-between min-h-[300px] text-left">
                 <Trophy className="absolute -right-10 -top-10 opacity-10 rotate-12" size={240} />
                 <div className="relative z-10 text-left">
                   <div className="flex items-center gap-2 mb-6 text-left"><Sparkles size={20} className="text-indigo-200" /><h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-100 text-left">The Golden Class</h3></div>
                   {weeklyStats.goldenClass ? (
                     <div className="text-left text-left"><h2 className="text-6xl font-black italic uppercase tracking-tighter leading-none mb-4 text-left">{weeklyStats.goldenClass.nama}</h2><p className="text-[11px] font-bold text-indigo-100 uppercase opacity-80 text-left">Efektivitas Kehadiran: {weeklyStats.goldenClass.ratio.toFixed(1)}%</p></div>
                   ) : <p className="opacity-50 text-left">Mengolah Data...</p>}
                 </div>
                 <p className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40 text-left text-left">Analysis: Last 7 Days</p>
               </div>
               <div className="p-10 rounded-[50px] bg-white/5 border border-white/10 shadow-xl flex flex-col justify-between text-left">
                  <div className="flex justify-between items-start mb-8 text-left text-left">
                    <div className="text-left text-left text-left"><h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-500 mb-2 text-left">Weekly Late Radar</h3><p className="text-[8px] font-bold text-gray-500 uppercase italic text-left">Siswa Terdeteksi Terlambat</p></div>
                    <Clock className="text-blue-500 text-left" size={24} />
                  </div>
                  <div className="space-y-3 overflow-y-auto max-h-[180px] pr-2 text-left text-left">
                    {weeklyStats.topLateSiswa.length === 0 ? <p className="text-center opacity-30 italic py-10 font-bold text-xs uppercase text-left text-left">Zero Late Record 🌿</p> : weeklyStats.topLateSiswa.map((s, idx) => (
                      <div key={idx} className="flex justify-between items-center p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all text-left text-left">
                        <div className="text-left text-left text-left text-left"><p className="text-[10px] font-black uppercase text-left text-left">{s.nama}</p><p className="text-[8px] font-bold opacity-30 uppercase text-left text-left">{s.kelas}</p></div>
                        <div className="bg-amber-500/10 text-amber-500 px-3 py-1 rounded-xl font-black text-[9px] uppercase tracking-widest text-left text-left text-left">{s.count} Kali</div>
                      </div>
                    ))}
                  </div>
               </div>
            </div>
            <div className="p-8 rounded-[45px] bg-green-500/5 border border-green-500/10 flex items-center justify-between text-left text-left text-left">
               <div className="text-left text-left text-left text-left text-left"><h4 className="text-lg font-black italic uppercase text-green-500 text-left text-left">Resume Laporan Mingguan</h4><p className="text-[10px] font-bold text-gray-500 uppercase mt-1 text-left text-left">Export data mingguan ke format Excel.</p></div>
               <button onClick={exportExcelAkumulasi} className="bg-green-600 text-white px-8 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg hover:scale-105 transition-all flex items-center gap-2 text-left"><Download size={16} /> Export Weekly</button>
            </div>
          </div>
        )}

        {activeTab === 'akumulasi' && (
          <div className="bg-white/5 p-8 rounded-[45px] border border-white/10 shadow-xl animate-in fade-in duration-500 text-left">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-6 text-left">
               <div className="text-left text-left text-left text-left text-left text-left"><h3 className="text-[10px] font-black uppercase tracking-widest text-blue-500 text-left text-left">Tabel Rekap Akumulasi</h3><p className="text-[8px] font-bold opacity-40 uppercase mt-1 italic tracking-widest text-left text-left">Mode: {modeAkumulasi.toUpperCase()}</p></div>
               <div className="flex-1 max-w-sm w-full text-left text-left text-left text-left text-left"><div className="relative flex items-center bg-white/10 rounded-2xl border border-white/10 px-4 py-2 group focus-within:border-blue-500 transition-all text-left text-left text-left text-left"><Search size={14} className="text-gray-500 group-focus-within:text-blue-500 text-left text-left" /><input type="text" placeholder="Cari nama siswa..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-transparent outline-none w-full ml-3 text-[10px] font-black uppercase text-white placeholder:text-gray-600 text-left text-left text-left" /></div></div>
               <div className="flex flex-wrap items-center gap-2 text-left text-left text-left">
                  <select value={modeAkumulasi} onChange={(e) => setModeAkumulasi(e.target.value)} className="bg-white/10 px-4 py-2 rounded-xl text-[9px] font-black uppercase outline-none text-white border border-white/10 cursor-pointer text-left text-left"><option value="bulan" className="text-black">BULAN INI</option><option value="hari" className="text-black">HARI INI</option><option value="custom" className="text-black">POSTING DATE</option></select>
                  {modeAkumulasi === 'bulan' && (<select value={filterBulan} onChange={(e) => setFilterBulan(parseInt(e.target.value))} className="bg-white/10 px-4 py-2 rounded-xl text-[9px] font-black uppercase outline-none text-white border border-white/10 cursor-pointer text-left text-left">{["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"].map((m, i) => <option key={i} value={i+1} className="text-black text-left">{m}</option>)}</select>)}
                  {modeAkumulasi === 'custom' && (<div className="flex items-center gap-2 bg-white/10 px-3 py-2 rounded-xl border border-white/10 text-left text-left"><input type="date" value={dariTgl} onChange={(e) => setDariTgl(e.target.value)} className="bg-transparent outline-none text-[9px] font-black text-white text-left text-left" /><ArrowRight size={12} className="opacity-30 text-left text-left text-left" /><input type="date" value={sampaiTgl} onChange={(e) => setSampaiTgl(e.target.value)} className="bg-transparent outline-none text-[9px] font-black text-white text-left text-left" /></div>)}
                  <button onClick={exportExcelAkumulasi} className="bg-green-600 text-white px-6 py-2 rounded-xl font-black text-[9px] uppercase shadow-lg hover:scale-105 transition-all flex items-center gap-2 text-left text-left"><Download size={14} className="text-left text-left text-left" /> Export</button>
               </div>
            </div>
            <div className="overflow-x-auto text-left text-left text-left text-left text-left text-left">
               <table className="w-full text-left text-left text-left text-left text-left text-left text-left">
                 <thead className="text-gray-500 uppercase border-b border-white/10 text-[9px] font-black tracking-widest italic text-left text-left text-left text-left">
                   <tr className="text-left text-left"><th className="pb-4 text-left text-left text-left">Nama Siswa</th><th className="pb-4 text-center text-left text-left">Kelas</th><th className="pb-4 text-center text-green-500 text-left text-left">H</th><th className="pb-4 text-center text-orange-500 text-left text-left">S</th><th className="pb-4 text-center text-blue-500 text-left text-left">I</th><th className="pb-4 text-center text-red-500 text-left text-left">A</th><th className="pb-4 text-center text-yellow-500 italic text-left text-left">T</th><th className="pb-4 text-center text-left text-left">Total</th></tr>
                 </thead>
                 <tbody className="text-[11px] font-bold text-left uppercase text-left text-left text-left text-left">
                   {filteredDataAkumulasi.length === 0 ? (<tr><td colSpan="8" className="py-20 text-center opacity-30 italic font-black text-xs text-left text-left text-left text-left">Data tidak ditemukan 🌿</td></tr>) : filteredDataAkumulasi.map((r, i) => (<tr key={i} className="border-b border-white/5 hover:bg-white/10 transition-all text-left text-left text-left text-left text-left"><td className="py-4 text-left uppercase text-left text-left text-left text-left text-left text-left">{r.nama}</td><td className="text-center opacity-40 font-black text-left text-left text-left text-left text-left">{r.kelas}</td><td className="text-center text-green-500 text-left text-left text-left text-left text-left">{r.hadir}</td><td className="text-center text-orange-500 text-left text-left text-left text-left text-left">{r.sakit}</td><td className="text-center text-blue-500 text-left text-left text-left text-left text-left">{r.izin}</td><td className="text-center text-red-500 text-left text-left text-left text-left text-left">{r.alpha}</td><td className="text-center text-yellow-500 italic text-left text-left text-left text-left text-left">{r.telat}</td><td className="text-center font-black italic text-left text-left text-left text-left text-left">{r.total}</td></tr>))}
                 </tbody>
               </table>
            </div>
          </div>
        )}
      </div>
    </PageContainer>
  );
};

export default ExecutiveDashboard;
