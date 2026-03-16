import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { Search, User, Printer, Clock, ArrowRight, Loader2, LogOut } from 'lucide-react';
import { createLogPiket, fetchMasterKelas, searchSiswaAktif } from './services/piketService';
import { printPiketReceipt } from './services/piketPrintService';

const PiketInput = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [siswaFound, setSiswaFound] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSiswa, setSelectedSiswa] = useState(null);
  const [namaPiket, setNamaPiket] = useState('');
  const [filterKelas, setFilterKelas] = useState('');
  const [daftarKelas, setDaftarKelas] = useState([]);

  useEffect(() => { fetchKelas(); }, []);

  const fetchKelas = async () => {
    try {
      const data = await fetchMasterKelas();
      setDaftarKelas(data);
    } catch (err) { console.error(err); }
  };

  const handleSearch = async () => {
    if (!searchTerm && !filterKelas) return;
    setLoading(true);
    try {
      const data = await searchSiswaAktif({ searchTerm, filterKelas, limit: 40 });
      setSiswaFound(data.map(s => ({ ...s, kelas_nama: s.master_kelas?.nama_kelas || '---' })));
    } finally { setLoading(false); }
  };

  const handlePrint = (logData) => {
    printPiketReceipt({
      namaSiswa: logData.nama_siswa,
      kelas: logData.kelas,
      jenis: logData.jenis,
      alasan: logData.alasan,
      namaPiket: logData.piket,
      isDuplicate: false,
    });
  };

  const submitLayanan = async (jenis) => {
    if (!selectedSiswa || !namaPiket) return Swal.fire('Oops', 'Lengkapi data!', 'warning');
    const { value: alasan } = await Swal.fire({ title: `Alasan ${jenis}`, input: 'textarea', confirmButtonColor: '#2563eb' });
    if (alasan) {
      try {
        setLoading(true);
        await createLogPiket({
          siswaId: selectedSiswa.id,
          jenisLog: jenis,
          alasan,
          namaPiket,
        });
        handlePrint({ nama_siswa: selectedSiswa.nama_siswa, kelas: selectedSiswa.kelas_nama, jenis: jenis, alasan: alasan, piket: namaPiket });
        setSelectedSiswa(null); setSearchTerm('');
      } finally { setLoading(false); }
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 pb-20 font-sans text-left">
      <header className="mb-6">
        <h1 className="text-3xl font-black italic uppercase text-gray-800 tracking-tighter leading-none text-left">Layanan Piket</h1>
        <p className="text-blue-600 font-bold text-[9px] tracking-[0.3em] mt-2 uppercase text-left">SMK Negeri 1 Rongga</p>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-white p-5 rounded-[30px] border border-gray-100 shadow-sm text-left">
          <label className="text-[8px] font-black uppercase text-gray-400 mb-2 block tracking-widest text-left">Petugas Meja Piket</label>
          <input type="text" placeholder="Nama Anda..." className="w-full bg-blue-50/50 p-4 rounded-2xl font-black text-xs outline-none border border-blue-100 uppercase" value={namaPiket} onChange={(e) => setNamaPiket(e.target.value)} />
        </div>
        <div className="bg-white p-5 rounded-[30px] border border-gray-100 shadow-sm text-left">
          <label className="text-[8px] font-black uppercase text-gray-400 mb-2 block tracking-widest text-left">Filter per Kelas</label>
          <select className="w-full bg-gray-50 p-4 rounded-2xl font-black text-xs outline-none border border-gray-100 cursor-pointer uppercase" value={filterKelas} onChange={(e) => setFilterKelas(e.target.value)}>
            <option value="">-- SEMUA KELAS --</option>
            {daftarKelas.map(k => <option key={k.id} value={k.id}>KELAS {k.nama_kelas}</option>)}
          </select>
        </div>
      </div>
      <div className="bg-gray-900 p-6 rounded-[40px] shadow-2xl mb-6 text-white text-left">
        <div className="flex gap-2 mb-6">
          <div className="flex-1 flex items-center gap-3 bg-white/10 px-5 py-3 rounded-2xl border border-white/10">
            <Search className="text-gray-400" size={18} />
            <input type="text" placeholder="Cari Nama Siswa..." className="bg-transparent outline-none font-bold text-xs w-full uppercase" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} onKeyUp={(e) => e.key === 'Enter' && handleSearch()} />
          </div>
          <button onClick={handleSearch} className="bg-blue-600 px-8 py-3 rounded-2xl font-black text-[10px] uppercase">{loading ? <Loader2 className="animate-spin" size={16} /> : 'CARI'}</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {siswaFound.map((s) => (
            <div key={s.id} onClick={() => setSelectedSiswa(s)} className={`p-4 rounded-[25px] border cursor-pointer transition-all flex justify-between items-center ${selectedSiswa?.id === s.id ? 'bg-blue-600 border-blue-400' : 'bg-white/5 border-white/5'}`}>
              <div className="text-left"><p className="text-[11px] font-black uppercase">{s.nama_siswa}</p><p className="text-[8px] font-bold text-blue-400 uppercase">{s.kelas_nama}</p></div>
              <ArrowRight size={14} />
            </div>
          ))}
        </div>
      </div>
      {selectedSiswa && (
        <div className="bg-white p-8 rounded-[45px] border border-gray-100 shadow-2xl text-left animate-in slide-in-from-bottom-5">
          <div className="flex items-center gap-4 mb-8 pb-6 border-b border-gray-50 text-left">
            <div className="w-14 h-14 bg-blue-600 rounded-[20px] flex items-center justify-center text-white"><User size={28} /></div>
            <div className="text-left"><h2 className="text-sm font-black uppercase text-gray-800 leading-tight">{selectedSiswa.nama_siswa}</h2><p className="text-[10px] font-black text-blue-500 uppercase mt-1">Siswa Terpilih • {selectedSiswa.kelas_nama}</p></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <button onClick={() => submitLayanan('Izin Keluar')} className="bg-amber-50 text-amber-600 flex flex-col items-center p-6 rounded-[30px] font-black"><Clock size={24}/><span className="text-[9px] mt-3 uppercase tracking-widest text-center">Izin Keluar</span></button>
            <button onClick={() => submitLayanan('Izin Pulang')} className="bg-red-50 text-red-600 flex flex-col items-center p-6 rounded-[30px] font-black"><LogOut size={24}/><span className="text-[9px] mt-3 uppercase tracking-widest text-center">Izin Pulang</span></button>
            <button onClick={() => submitLayanan('Izin Masuk')} className="bg-blue-50 text-blue-600 flex flex-col items-center p-6 rounded-[30px] font-black"><Printer size={24}/><span className="text-[9px] mt-3 uppercase tracking-widest text-center">Izin Masuk</span></button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PiketInput;
