import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Search, Calendar, Download, Printer, Loader2 } from 'lucide-react';

const RekapPiket = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTanggal, setFilterTanggal] = useState(new Date().toISOString().split('T')[0]);
  const [stats, setStats] = useState({ keluar: 0, pulang: 0, masuk: 0 });

  useEffect(() => { fetchLogs(); }, [filterTanggal]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const { data } = await supabase.from('log_piket').select(`*, siswa (nama_siswa, master_kelas (nama_kelas))`).order('created_at', { ascending: false });
      const formatted = data?.map(log => ({ ...log, nama_siswa: log.siswa?.nama_siswa, nama_kelas: log.siswa?.master_kelas?.nama_kelas, tanggal_log: new Date(log.created_at).toISOString().split('T')[0] })).filter(log => log.tanggal_log === filterTanggal);
      setLogs(formatted || []);
      const s = { keluar: 0, pulang: 0, masuk: 0 };
      formatted?.forEach(d => { if(d.jenis_log === 'Izin Keluar') s.keluar++; if(d.jenis_log === 'Izin Pulang') s.pulang++; if(d.jenis_log === 'Izin Masuk') s.masuk++; });
      setStats(s);
    } finally { setLoading(false); }
  };

  const handlePrint = (log) => {
    const tgl = new Date(log.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const jam = new Date(log.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    const content = `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * { box-sizing: border-box; }
            body { margin: 0; padding: 0; font-family: monospace; width: 100%; background: #fff; color: #000; }
            .wrapper { width: 85%; margin: 0 auto; padding: 10px 0; }
            #btnCetak { width: 90%; margin: 15px auto; display: block; padding: 15px; background: #000; color: #fff; border: none; font-weight: bold; border-radius: 10px; font-size: 14px; cursor: pointer; }
            .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 8px; margin-bottom: 15px; }
            .info-box { font-size: 13px; margin-bottom: 10px; }
            .label { font-size: 10px; color: #666; text-transform: uppercase; margin-top: 8px; }
            .val { font-weight: 900; font-size: 16px; display: block; text-transform: uppercase; }
            .footer { margin-top: 25px; text-align: center; border-top: 1px dashed #000; padding-top: 15px; }
            .ttd-box { margin-top: 10px; height: 60px; border-bottom: 1px dotted #000; width: 140px; margin-left: auto; margin-right: auto; }
          </style>
        </head>
        <body>
          <button id="btnCetak" onclick="mulaiPrint()">CETAK ULANG STRUK</button>
          
          <div class="wrapper">
            <div class="header">
              <div style="font-size: 18px; font-weight: 900;">SMK N 1 RONGGA</div>
              <div style="font-size: 10px;">Salinan Surat Izin</div>
            </div>
            <div class="info-box">
              <div style="text-align: center; font-weight: 900; font-size: 14px; text-decoration: underline; margin-bottom: 15px;">SURAT IZIN SISWA</div>
              <div style="font-weight: bold; margin-bottom: 10px;">
                TANGGAL: ${tgl}<br>
                WAKTU  : ${jam} WIB
              </div>
              <div class="label">Siswa:</div><span class="val">${log.nama_siswa}</span>
              <div class="label">Kelas:</div><span class="val">${log.nama_kelas}</span>
              <div class="label">Izin:</div><span class="val">${log.jenis_log}</span>
              <div class="label">Alasan:</div><div style="font-weight: bold; font-style: italic; font-size: 13px;">"${log.alasan}"</div>
            </div>
            <div class="footer">
              <div style="font-size: 11px;">Petugas Piket,</div>
              <div class="ttd-box"></div>
              <div style="font-weight: 900; font-size: 14px; margin-top: 8px;">( ${log.nama_piket.toUpperCase()} )</div>
              <div style="font-size: 9px; margin-top: 10px;">DUPLIKAT STRUK</div>
            </div>
          </div>

          <script>
            function mulaiPrint() {
              const btn = document.getElementById('btnCetak');
              btn.style.display = 'none';
              window.print();
              setTimeout(() => {
                btn.style.display = 'block';
              }, 1000);
            }
          </script>
        </body>
      </html>
    `;

    const printWindow = window.open('about:blank', '_blank');
    printWindow.document.write(content);
    printWindow.document.close();
  };

  const filteredLogs = logs.filter(l => l.nama_siswa?.toLowerCase().includes(searchTerm.toLowerCase()) || l.nama_kelas?.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="max-w-6xl mx-auto p-4 pb-20 font-sans text-left text-gray-800">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div><h1 className="text-3xl font-black italic uppercase text-gray-800 tracking-tighter leading-none text-left">Histori Layanan</h1><p className="text-blue-600 font-bold text-[10px] tracking-[0.3em] uppercase mt-2 text-left">Arsip & Rekapitulasi Piket</p></div>
      </header>
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white p-5 rounded-[30px] border border-gray-100 shadow-sm text-center">
          <p className="text-[8px] font-black text-gray-400 uppercase mb-1 tracking-widest text-center">Keluar</p>
          <h3 className="text-2xl font-black text-amber-500 leading-none">{stats.keluar}</h3>
        </div>
        <div className="bg-white p-5 rounded-[30px] border border-gray-100 shadow-sm text-center">
          <p className="text-[8px] font-black text-gray-400 uppercase mb-1 tracking-widest text-center">Pulang</p>
          <h3 className="text-2xl font-black text-red-500 leading-none">{stats.pulang}</h3>
        </div>
        <div className="bg-white p-5 rounded-[30px] border border-gray-100 shadow-sm text-center">
          <p className="text-[8px] font-black text-gray-400 uppercase mb-1 tracking-widest text-center">Masuk</p>
          <h3 className="text-2xl font-black text-blue-500 leading-none">{stats.masuk}</h3>
        </div>
      </div>

      <div className="bg-white p-4 rounded-[35px] border border-gray-100 shadow-sm mb-6 flex flex-col md:flex-row gap-4">
        <div className="flex-1 flex items-center gap-3 bg-gray-50 px-5 py-3 rounded-2xl"><Search size={18} className="text-gray-400" /><input type="text" placeholder="Cari nama atau kelas..." className="bg-transparent outline-none font-bold text-xs w-full uppercase text-left" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
        <div className="flex items-center gap-3 bg-blue-50 px-5 py-3 rounded-2xl border border-blue-100"><Calendar size={18} className="text-blue-600" /><input type="date" className="bg-transparent outline-none font-black text-[10px] uppercase text-blue-700 cursor-pointer text-left" value={filterTanggal} onChange={(e) => setFilterTanggal(e.target.value)} /></div>
      </div>

      <div className="bg-white rounded-[40px] border border-gray-100 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead><tr className="bg-gray-900 text-white"><th className="p-6 text-[9px] font-black uppercase italic text-left">Waktu</th><th className="p-6 text-[9px] font-black uppercase italic text-left">Siswa</th><th className="p-6 text-[9px] font-black uppercase italic text-center">Layanan</th><th className="p-6 text-[9px] font-black uppercase italic text-left">Keterangan</th><th className="p-6 text-center italic text-[9px] font-black uppercase tracking-widest text-center">Aksi</th></tr></thead>
            <tbody className="divide-y divide-gray-50 text-left">
              {filteredLogs.map((log) => (
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
    </div>
  );
};

export default RekapPiket;