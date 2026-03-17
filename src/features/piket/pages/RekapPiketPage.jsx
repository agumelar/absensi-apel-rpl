import React, { useCallback, useState, useEffect } from 'react';
import { Search, Calendar, Printer, Loader2 } from 'lucide-react';
import { fetchPiketLogByTanggal } from '../../../services/piketService';
import { printPiketReceipt } from '../../../services/piketPrintService';
import Card, { CardContent } from '../../../shared/ui/Card';
import { PageContainer, PageHeader, PageSubtitle, PageTitle } from '../../../shared/ui/PageLayout';

const RekapPiket = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTanggal, setFilterTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [stats, setStats] = useState({ keluar: 0, pulang: 0, masuk: 0 });

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const formatted = await fetchPiketLogByTanggal(filterTanggal);
      setLogs(formatted || []);
      const s = { keluar: 0, pulang: 0, masuk: 0 };
      formatted?.forEach(d => { if(d.jenis_log === 'Izin Keluar') s.keluar++; if(d.jenis_log === 'Izin Pulang') s.pulang++; if(d.jenis_log === 'Izin Masuk') s.masuk++; });
      setStats(s);
    } finally { setLoading(false); }
  }, [filterTanggal]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handlePrint = (log) => {
    printPiketReceipt({
      createdAt: log.created_at,
      namaSiswa: log.nama_siswa,
      kelas: log.nama_kelas,
      jenis: log.jenis_log,
      alasan: log.alasan,
      namaPiket: log.nama_piket,
      isDuplicate: true,
    });
  };

  const filteredLogs = logs.filter(l => l.nama_siswa?.toLowerCase().includes(searchTerm.toLowerCase()) || l.nama_kelas?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <PageContainer className="pb-20 text-left text-gray-800">
      <PageHeader className="mb-8">
        <div><PageTitle className="text-3xl italic uppercase">Histori Layanan</PageTitle><PageSubtitle className="mt-2">Arsip & Rekapitulasi Piket</PageSubtitle></div>
      </PageHeader>
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card className="rounded-[30px]"><CardContent className="p-5 text-center">
          <p className="text-[8px] font-black text-gray-400 uppercase mb-1 tracking-widest text-center">Keluar</p>
          <h3 className="text-2xl font-black text-amber-500 leading-none">{stats.keluar}</h3>
        </CardContent></Card>
        <Card className="rounded-[30px]"><CardContent className="p-5 text-center">
          <p className="text-[8px] font-black text-gray-400 uppercase mb-1 tracking-widest text-center">Pulang</p>
          <h3 className="text-2xl font-black text-red-500 leading-none">{stats.pulang}</h3>
        </CardContent></Card>
        <Card className="rounded-[30px]"><CardContent className="p-5 text-center">
          <p className="text-[8px] font-black text-gray-400 uppercase mb-1 tracking-widest text-center">Masuk</p>
          <h3 className="text-2xl font-black text-blue-500 leading-none">{stats.masuk}</h3>
        </CardContent></Card>
      </div>

      <div className="bg-white p-4 rounded-[35px] border border-gray-100 shadow-sm mb-6 flex flex-col md:flex-row gap-4">
        <div className="flex-1 flex items-center gap-3 bg-gray-50 px-5 py-3 rounded-2xl"><Search size={18} className="text-gray-400" /><input type="text" placeholder="Cari nama atau kelas..." className="bg-transparent outline-none font-bold text-xs w-full uppercase text-left" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
        <div className="flex items-center gap-3 bg-blue-50 px-5 py-3 rounded-2xl border border-blue-100"><Calendar size={18} className="text-blue-600" /><input type="date" className="bg-transparent outline-none font-black text-[10px] uppercase text-blue-700 cursor-pointer text-left" value={filterTanggal} onChange={(e) => setFilterTanggal(e.target.value)} /></div>
      </div>

      <div className="bg-white rounded-[40px] border border-gray-100 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="premium-table text-left">
            <thead>
              <tr className="bg-gray-900 text-white">
                <th className="italic text-left">Waktu</th>
                <th className="italic text-left">Siswa</th>
                <th className="italic text-center">Layanan</th>
                <th className="italic text-left">Keterangan</th>
                <th className="text-center italic">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 text-left">
              {loading && (
                <tr>
                  <td colSpan={5} className="p-10">
                    <div className="flex items-center justify-center gap-2 text-blue-600">
                      <Loader2 size={16} className="animate-spin" />
                      <span className="micro-loading">Memuat data layanan...</span>
                    </div>
                  </td>
                </tr>
              )}
              {!loading && filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-blue-50/20 transition-all text-left">
                  <td className="p-6 text-left"><p className="text-[10px] font-black uppercase text-left">{new Date(log.created_at).toLocaleTimeString('id-ID', {hour:'2-digit', minute:'2-digit'})}</p><span className="text-[8px] font-black text-blue-600 uppercase italic text-left">{log.nama_piket}</span></td>
                  <td className="p-6 text-left"><p className="text-[11px] font-black uppercase text-left">{log.nama_siswa}</p><p className="text-[9px] font-bold text-gray-400 uppercase text-left">{log.nama_kelas}</p></td>
                  <td className="p-6 text-center text-left"><span className={`px-3 py-1.5 rounded-xl text-[8px] font-black uppercase ${log.jenis_log === 'Izin Pulang' ? 'bg-red-600 text-white' : log.jenis_log === 'Izin Keluar' ? 'bg-amber-500 text-white' : 'bg-blue-600 text-white'}`}>{log.jenis_log}</span></td>
                  <td className="p-6 text-[10px] text-gray-600 italic text-left">"{log.alasan}"</td>
                  <td className="p-6 text-center"><button onClick={() => handlePrint(log)} className="p-3 bg-gray-100 text-gray-600 rounded-2xl hover:bg-blue-600 hover:text-white transition-all text-center"><Printer size={16} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PageContainer>
  );
};

export default RekapPiket;
