import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { 
  TrendingUp, AlertTriangle, Users, ShieldCheck, GraduationCap, 
  Loader2, Sun, Moon, CheckCircle, Info, Clock, BarChart3, Filter, 
  Calendar, Download, Building, Briefcase, TableProperties 
} from 'lucide-react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import * as XLSX from 'xlsx';

const ExecutiveDashboard = ({ user }) => {
  const [activeTab, setActiveTab] = useState('monitoring');
  const [darkMode, setDarkMode] = useState(true);
  const [loading, setLoading] = useState(true);
  const [exportingAkumulasi, setExportingAkumulasi] = useState(false);
  const [stats, setStats] = useState({ Hadir: 0, Sakit: 0, Izin: 0, Alpha: 0, Kesiangan: 0, Total: 0 });
  const [filterJurusan, setFilterJurusan] = useState('Semua');
  const [filterKelas, setFilterKelas] = useState('Semua');
  const [filterBulan, setFilterBulan] = useState(new Date().getMonth() + 1);
  const [masterJurusan, setMasterJurusan] = useState([]);
  const [daftarKelas, setDaftarKelas] = useState([]);
  const [warningWalas, setWarningWalas] = useState([]);
  const [rankingKelas, setRankingKelas] = useState([]);
  const [ewsSiswa, setEwsSiswa] = useState([]);
  const [dataAkumulasi, setDataAkumulasi] = useState([]);

  const userRole = user?.role?.toLowerCase();
  const isKepsek = userRole === 'kepsek';
  const isKaprog = userRole === 'kaprog';
  const isKesiswaan = userRole === 'kesiswaan';
  const isGlobalAccess = isKepsek || isKesiswaan;
  const canSeeAkumulasi = isKesiswaan || isKaprog;

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (isKepsek && activeTab !== 'monitoring') setActiveTab('monitoring');
    fetchExecutiveData();
  }, [filterKelas, filterBulan, filterJurusan, activeTab]);

  const fetchInitialData = async () => {
    const { data: jurs } = await supabase.from('master_jurusan').select('*');
    setMasterJurusan(jurs || []);
  };

  const fetchExecutiveData = async () => {
    try {
      setLoading(true);
      const hariIni = new Date().toISOString().split('T')[0];
      const tahunIni = new Date().getFullYear();
      const awalBulan = `${tahunIni}-${String(filterBulan).padStart(2, '0')}-01`;
      const akhirBulan = `${tahunIni}-${String(filterBulan).padStart(2, '0')}-31`;

      let queryKelas = supabase.from('master_kelas').select('id, nama_kelas, jurusan_id');
      if (isKaprog) queryKelas = queryKelas.eq('jurusan_id', parseInt(user.jurusan_id));
      else if (isGlobalAccess && filterJurusan !== 'Semua') queryKelas = queryKelas.eq('jurusan_id', parseInt(filterJurusan));
      
      const { data: mKelas } = await queryKelas;
      setDaftarKelas(mKelas || []);
      const listKelasIds = (mKelas || []).map(k => k.id);

      if (listKelasIds.length === 0) { setLoading(false); return; }

      const { data: dataSiswa } = await supabase.from('siswa').select('id, nama_siswa, kelas_id, master_kelas(nama_kelas)').eq('status_siswa', 'Aktif');
      const siswaTerfilter = (dataSiswa || []).filter(s => listKelasIds.includes(s.kelas_id));

      const { data: dataAbsenHarian } = await supabase.from('absensi').select('*').eq('tanggal', hariIni);
      const { data: dataAbsenBulan } = await supabase.from('absensi').select('status, siswa_id').in('siswa_id', siswaTerfilter.map(s => s.id)).gte('tanggal', awalBulan).lte('tanggal', akhirBulan);

      if (activeTab === 'monitoring') {
        const targetSiswaIds = (filterKelas === 'Semua') ? siswaTerfilter.map(s => s.id) : siswaTerfilter.filter(s => s.kelas_id === parseInt(filterKelas)).map(s => s.id);
        const harianFinal = (dataAbsenHarian || []).filter(a => targetSiswaIds.includes(a.siswa_id));
        
        const counts = { Hadir: 0, Sakit: 0, Izin: 0, Alpha: 0, Kesiangan: 0 };
        harianFinal.forEach(a => { if(counts.hasOwnProperty(a.status)) counts[a.status]++ });
        setStats({ ...counts, Total: filterKelas === 'Semua' ? siswaTerfilter.length : siswaTerfilter.filter(s => s.kelas_id === parseInt(filterKelas)).length });

        const { data: allWalas } = await supabase.from('walikelas').select('nama_lengkap, kelas_id');
        setWarningWalas((mKelas || []).map(k => ({
          nama: k.nama_kelas,
          walas: (allWalas || []).find(w => w.kelas_id === k.id)?.nama_lengkap || 'Belum Diatur',
          status: (dataAbsenHarian || []).some(a => (dataSiswa || []).filter(s => s.kelas_id === k.id).map(s => s.id).includes(a.siswa_id))
        })).filter(k => !k.status));

        setRankingKelas((mKelas || []).map(k => ({
          nama: k.nama_kelas,
          masalah: (dataAbsenHarian || []).filter(a => (dataSiswa || []).filter(s => s.kelas_id === k.id).map(s => s.id).includes(a.siswa_id) && ['Alpha', 'Kesiangan'].includes(a.status)).length
        })).sort((a, b) => b.masalah - a.masalah));
      }

      const rekapAkumulasi = siswaTerfilter.map(s => {
        const absenSiswa = (dataAbsenBulan || []).filter(a => a.siswa_id === s.id);
        const h = absenSiswa.filter(a => a.status === 'Hadir').length;
        const s_ = absenSiswa.filter(a => a.status === 'Sakit').length;
        const i = absenSiswa.filter(a => a.status === 'Izin').length;
        const a = absenSiswa.filter(a => a.status === 'Alpha').length;
        const k = absenSiswa.filter(a => a.status === 'Kesiangan').length;
        return { 
          nama: s.nama_siswa, kelas: s.master_kelas.nama_kelas, kelas_id: s.kelas_id, 
          hadir: h, sakit: s_, izin: i, alpha: a, telat: k, total: h+s_+i+a+k 
        };
      });

      setDataAkumulasi(filterKelas === 'Semua' ? rekapAkumulasi : rekapAkumulasi.filter(r => r.kelas_id === parseInt(filterKelas)));
      setEwsSiswa(rekapAkumulasi.filter(s => s.alpha > 2 || s.telat > 3).sort((a, b) => b.alpha - a.alpha));
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const exportExcelAkumulasi = async () => {
    try {
      setExportingAkumulasi(true);
      await new Promise(r => setTimeout(r, 800));
      const ws = XLSX.utils.json_to_sheet(dataAkumulasi);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Akumulasi");
      XLSX.writeFile(wb, `Rekap_Akumulasi_${filterKelas}_Bulan_${filterBulan}.xlsx`);
    } finally { setExportingAkumulasi(false); }
  };

  if (loading) return <div className="h-screen bg-gray-950 flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={40} /></div>;

  return (
    <div className={`min-h-screen transition-all duration-500 ${darkMode ? 'bg-gray-950 text-white' : 'bg-gray-50 text-gray-900'}`}>
      <div className="max-w-7xl mx-auto p-6 pb-20">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
          <div className="flex flex-col gap-2">
             {canSeeAkumulasi && (
               <div className="flex items-center gap-4 bg-white/5 p-1 rounded-2xl border border-white/10 w-fit">
                  <button onClick={() => setActiveTab('monitoring')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'monitoring' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>Monitoring</button>
                  <button onClick={() => setActiveTab('akumulasi')} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'akumulasi' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>Akumulasi</button>
               </div>
             )}
             <h1 className="text-3xl font-black italic uppercase tracking-tighter mt-2">{activeTab === 'monitoring' ? 'Radar Control' : 'Rekap Akumulasi'}</h1>
          </div>
          <div className="flex items-center gap-3">
            {isGlobalAccess && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-2xl border border-white/10 bg-white/5">
                <Building size={14} className="text-blue-500" />
                <select value={filterJurusan} onChange={(e) => {setFilterJurusan(e.target.value); setFilterKelas('Semua')}} className="bg-transparent outline-none text-[10px] font-black uppercase cursor-pointer">
                  <option value="Semua" className="text-black">SEMUA JURUSAN</option>
                  {masterJurusan.map(j => <option key={j.id} value={j.id} className="text-black">{j.nama_jurusan}</option>)}
                </select>
              </div>
            )}
            <div className="flex items-center gap-2 px-4 py-2 rounded-2xl border border-white/10 bg-white/5">
              <Filter size={14} className="text-blue-500" />
              <select value={filterKelas} onChange={(e) => setFilterKelas(e.target.value)} className="bg-transparent outline-none text-[10px] font-black uppercase cursor-pointer">
                <option value="Semua" className="text-black">SEMUA KELAS</option>
                {daftarKelas.map(k => <option key={k.id} value={k.id} className="text-black">{k.nama_kelas}</option>)}
              </select>
            </div>
            <button onClick={() => setDarkMode(!darkMode)} className="p-3 bg-white/5 border border-white/10 rounded-2xl">{darkMode ? <Sun size={20} className="text-yellow-400"/> : <Moon size={20} className="text-gray-400"/>}</button>
          </div>
        </header>

        {activeTab === 'monitoring' ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
              {[
                { l: 'Siswa', v: stats.Total, c: 'text-blue-500', i: <Users size={20}/> },
                { l: 'Hadir', v: stats.Hadir, c: 'text-green-500', i: <CheckCircle size={20}/> },
                { l: 'Sakit', v: stats.Sakit, c: 'text-orange-500', i: <Info size={20}/> },
                { l: 'Izin', v: stats.Izin, c: 'text-blue-400', i: <Clock size={20}/> },
                { l: 'Alpha', v: stats.Alpha, c: 'text-red-500', i: <AlertTriangle size={20}/> },
                { l: 'Telat', v: stats.Kesiangan, c: 'text-yellow-500', i: <Clock size={20}/> },
              ].map((x, i) => (
                <div key={i} className="p-6 rounded-[30px] border border-white/10 bg-white/5 text-center transition-transform hover:scale-105">
                  <div className={`${x.c} flex justify-center mb-3`}>{x.i}</div>
                  <h3 className="text-3xl font-black">{x.v}</h3>
                  <p className="text-[9px] uppercase font-black opacity-40 tracking-widest">{x.l}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
               {/* RADAR KEDISIPLINAN (FIX VISUAL) */}
               <div className="lg:col-span-2 p-8 rounded-[45px] bg-white/5 border border-white/10">
                 <h3 className="text-[10px] font-black uppercase mb-6 text-blue-500 flex items-center gap-2"><BarChart3 size={16} /> Radar Kedisiplinan</h3>
                 <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={rankingKelas} margin={{ top: 20, right: 30, left: 0, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff10" />
                        <XAxis 
                          dataKey="nama" 
                          axisLine={false} 
                          tickLine={false} 
                          tick={{ fill: '#94a3b8', fontSize: 9, fontWeight: 'bold' }}
                          interval={0}
                          angle={-45}
                          textAnchor="end"
                        />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                        <Tooltip 
                          cursor={{ fill: '#ffffff05' }}
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-gray-900 border border-white/10 p-3 rounded-2xl shadow-2xl backdrop-blur-md">
                                  <p className="text-[10px] font-black text-blue-400 uppercase mb-1">{payload[0].payload.nama}</p>
                                  <p className="text-xl font-black text-white">{payload[0].value} <span className="text-[8px] opacity-40">KASUS</span></p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="masalah" radius={[6, 6, 0, 0]} barSize={25}>
                          {rankingKelas.map((e, idx) => (
                            <Cell key={idx} fill={e.masalah > 5 ? '#ef4444' : e.masalah > 2 ? '#f59e0b' : '#3b82f6'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                 </div>
               </div>
               
               <div className="p-8 rounded-[45px] bg-red-500/5 border border-red-500/20 max-h-[410px] overflow-y-auto">
                 <h3 className="text-[10px] font-black uppercase mb-6 text-red-500 flex items-center gap-2"><AlertTriangle size={16} /> Belum Absen</h3>
                 <div className="space-y-3">
                   {warningWalas.length === 0 ? <p className="text-[10px] font-bold opacity-30 italic text-center py-10">Semua kelas sudah absen</p> : warningWalas.map((w, i) => (
                     <div key={i} className="p-4 rounded-2xl bg-white/5 flex justify-between items-center border border-white/5">
                       <div><p className="text-[10px] font-black uppercase leading-tight">{w.nama}</p><p className="text-[8px] font-bold opacity-40 uppercase mt-1">{w.walas}</p></div>
                       <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping"></div>
                     </div>
                   ))}
                 </div>
               </div>

               <div className="lg:col-span-3 p-8 rounded-[45px] bg-white/5 border border-white/10">
                 <div className="flex justify-between items-center mb-8">
                   <div className="flex items-center gap-3">
                     <div className="p-2 bg-red-500/20 rounded-xl text-red-500"><AlertTriangle size={20}/></div>
                     <div>
                       <h3 className="text-[10px] font-black uppercase tracking-widest text-red-500">Target Pembinaan Siswa</h3>
                       <p className="text-[8px] font-bold opacity-40 uppercase mt-1">Siswa dengan Alpha {'>'} 2 atau Telat {'>'} 3</p>
                     </div>
                   </div>
                   <select value={filterBulan} onChange={(e) => setFilterBulan(parseInt(e.target.value))} className="bg-white/10 px-4 py-2 rounded-xl text-[10px] font-black uppercase border-none outline-none">
                     {["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"].map((m, i) => <option key={i} value={i+1} className="text-black">{m}</option>)}
                   </select>
                 </div>
                 <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                   {ewsSiswa.length === 0 ? <div className="col-span-4 py-10 text-center opacity-30 font-black italic uppercase text-xs">Siswa terpantau disiplin 🌿</div> : ewsSiswa.map((s, i) => (
                     <div key={i} className="p-5 rounded-[25px] bg-white/5 border border-white/5 hover:bg-white/10 transition-all flex flex-col">
                       <div className="flex gap-1 mb-3">
                         {s.alpha > 2 && <span className="px-2 py-1 bg-red-600 text-white text-[8px] font-black rounded-md">{s.alpha} Alpha</span>}
                         {s.telat > 3 && <span className="px-2 py-1 bg-yellow-500 text-white text-[8px] font-black rounded-md">{s.telat} Telat</span>}
                       </div>
                       <p className="text-[10px] font-black uppercase leading-tight">{s.nama}</p>
                       <p className="text-[7px] font-bold opacity-30 mt-1 uppercase tracking-widest">{s.kelas}</p>
                     </div>
                   ))}
                 </div>
               </div>
            </div>
          </>
        ) : (
          <div className="bg-white/5 p-8 rounded-[45px] border border-white/10 shadow-xl">
            <div className="flex justify-between items-center mb-8">
               <div>
                 <h3 className="text-[10px] font-black uppercase tracking-widest text-blue-500">Tabel Rekap Akumulasi Bulanan</h3>
                 <p className="text-[8px] font-bold opacity-40 uppercase mt-1">Data Periode: {filterBulan} - {new Date().getFullYear()}</p>
               </div>
               <button onClick={exportExcelAkumulasi} disabled={exportingAkumulasi} className="bg-green-600 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase shadow-lg shadow-green-900/20 hover:scale-105 transition-all flex items-center gap-2">
                 {exportingAkumulasi ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} {exportingAkumulasi ? 'Processing...' : 'Export Excel'}
               </button>
            </div>
            <div className="overflow-x-auto">
               <table className="w-full text-left">
                 <thead>
                   <tr className="text-gray-500 uppercase border-b border-white/10 text-[9px] font-black tracking-widest">
                     <th className="pb-4">Nama Siswa</th>
                     <th className="pb-4 text-center">Kelas</th>
                     <th className="pb-4 text-center text-green-500">Hadir</th>
                     <th className="pb-4 text-center text-red-500">Alpha</th>
                     <th className="pb-4 text-center text-yellow-500">Telat</th>
                     <th className="pb-4 text-center italic">Total</th>
                   </tr>
                 </thead>
                 <tbody className="text-[11px] font-bold">
                   {dataAkumulasi.map((r, i) => (
                     <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-all">
                       <td className="py-4 uppercase">{r.nama}</td>
                       <td className="text-center opacity-40">{r.kelas}</td>
                       <td className="text-center text-green-500">{r.hadir}</td>
                       <td className="text-center text-red-500">{r.alpha}</td>
                       <td className="text-center text-yellow-500">{r.telat}</td>
                       <td className="text-center font-black italic">{r.total}</td>
                     </tr>
                   ))}
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