import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import * as XLSX from 'xlsx';
import { Calendar, Users, Loader2, ArrowRight, RefreshCw, FileDown, Search } from 'lucide-react';

const AkumulasiSiswa = ({ user }) => {
  // --- SUNTIKAN FIX TIMEZONE GMT+7 ---
  const getTodayDateWIB = () => {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  };

  const [dataAkumulasi, setDataAkumulasi] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Set default tanggal ke WIB
  const [dariTanggal, setDariTanggal] = useState(getTodayDateWIB());
  const [sampaiTanggal, setSampaiTanggal] = useState(getTodayDateWIB());

  useEffect(() => {
    if (user?.kelas_id || user?.role === 'admin') {
      fetchAkumulasi();
    }
  }, [dariTanggal, sampaiTanggal, user]);

  const fetchAkumulasi = async () => {
    try {
      setLoading(true);
      
      const kelasIdTarget = user?.kelas_id;

      let query = supabase
        .from('absensi')
        .select(`
          status, 
          siswa!inner (id, nama_siswa, nis, kelas_id)
        `)
        .gte('tanggal', dariTanggal)
        .lte('tanggal', sampaiTanggal);

      if (user?.role !== 'admin') {
        query = query.eq('siswa.kelas_id', kelasIdTarget);
      }

      const { data, error } = await query;
      if (error) throw error;

      const mapSiswa = {};
      data.forEach(item => {
        const idSiswa = item.siswa?.id;
        if (!mapSiswa[idSiswa]) {
          mapSiswa[idSiswa] = { 
            nama: item.siswa?.nama_siswa, 
            nis: item.siswa?.nis, 
            h: 0, s: 0, i: 0, k: 0, a: 0, total: 0 
          };
        }
        
        const st = item.status.toLowerCase();
        if (st === 'hadir') mapSiswa[idSiswa].h++;
        else if (st === 'sakit') mapSiswa[idSiswa].s++;
        else if (st === 'izin') mapSiswa[idSiswa].i++;
        else if (st === 'kesiangan') mapSiswa[idSiswa].k++;
        else if (st === 'alpha') mapSiswa[idSiswa].a++;
        
        mapSiswa[idSiswa].total++;
      });

      setDataAkumulasi(Object.values(mapSiswa).sort((a, b) => a.nama.localeCompare(b.nama)));
    } catch (error) {
      console.error('Error Akumulasi:', error.message);
    } finally {
      setLoading(false);
    }
  };

  const dataTerfilter = dataAkumulasi.filter(item => 
    item.nama.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.nis?.toString().includes(searchQuery)
  );

  const exportToExcel = () => {
    const dataExcel = dataTerfilter.map((s, index) => ({
      "No": index + 1,
      "Nama Siswa": s.nama,
      "NIS": s.nis,
      "H": s.h, "S": s.s, "I": s.i, "K": s.k, "A": s.a,
      "Total": s.total
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataExcel);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Rekap");
    XLSX.writeFile(workbook, `Rekap_Siswa_${user?.kelas_diampu || 'Semua'}_${getTodayDateWIB()}.xlsx`);
  };

  return (
    <div className="max-w-6xl mx-auto pb-20 p-4 font-sans text-gray-800 text-left">
      <header className="mb-8">
        <h1 className="text-4xl font-black italic tracking-tighter uppercase text-gray-800 leading-none">Akumulasi Siswa</h1>
        <p className="text-blue-600 font-bold text-[10px] tracking-[0.3em] mt-2 uppercase">
           Rekapitulasi Kehadiran • {user?.kelas_diampu || 'ADMIN'}
        </p>
      </header>

      <div className="relative mb-6">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search size={18} className="text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Cari nama siswa atau NIS..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-4 bg-white border border-gray-100 rounded-[25px] shadow-sm font-bold text-sm outline-none focus:border-blue-500 transition-all text-left"
        />
      </div>

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
        
        <div className="flex gap-2 ml-auto">
          <button onClick={fetchAkumulasi} className="bg-gray-100 text-gray-600 p-3 rounded-2xl hover:bg-gray-200 transition-all">
            <RefreshCw size={18} />
          </button>
          <button onClick={exportToExcel} disabled={dataTerfilter.length === 0} className="bg-green-600 text-white px-6 py-3 rounded-2xl font-black text-[10px] flex items-center gap-2 hover:bg-green-700 transition-all shadow-lg disabled:opacity-50 uppercase tracking-widest">
            <FileDown size={14} /> Export ({dataTerfilter.length})
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[40px] shadow-lg border border-gray-50 overflow-hidden text-left">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-blue-600 text-white text-center font-black uppercase text-[10px] tracking-widest italic">
                <th className="p-6 text-left">Nama Siswa</th>
                <th className="p-6 bg-green-600 w-16">H</th>
                <th className="p-6 bg-orange-500 w-16">S</th>
                <th className="p-6 bg-blue-700 w-16">I</th>
                <th className="p-6 bg-amber-600 w-16">K</th>
                <th className="p-6 bg-red-600 w-16">A</th>
                <th className="p-6 bg-gray-800 w-24 italic">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-bold text-xs">
              {loading ? (
                <tr><td colSpan="7" className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-blue-600" /></td></tr>
              ) : dataTerfilter.length === 0 ? (
                <tr><td colSpan="7" className="p-20 text-center font-bold text-gray-300 uppercase italic">Tidak ada data absensi di rentang ini</td></tr>
              ) : (
                dataTerfilter.map((s, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-all group">
                    <td className="p-6 text-left">
                      <p className="font-black text-gray-800 uppercase group-hover:text-blue-600 transition-colors">{s.nama}</p>
                      <p className="text-[9px] text-gray-400 font-mono tracking-tighter">NIS: {s.nis}</p>
                    </td>
                    <td className="p-6 text-center font-black text-green-600 bg-green-50/20">{s.h}</td>
                    <td className="p-6 text-center font-black text-orange-500 bg-orange-50/20">{s.s}</td>
                    <td className="p-6 text-center font-black text-blue-700 bg-blue-50/20">{s.i}</td>
                    <td className="p-6 text-center font-black text-amber-600 bg-amber-50/20">{s.k}</td>
                    <td className="p-6 text-center font-black text-red-600 bg-red-50/20">{s.a}</td>
                    <td className="p-6 text-center font-black text-gray-900 bg-gray-100 italic">{s.total}</td>
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

export default AkumulasiSiswa;