import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import Swal from 'sweetalert2';
import { Filter, Loader2, Clock, Image as ImageIcon, Coffee, UserCheck } from 'lucide-react';
import { compressImage } from './utils/compressor'; // <--- Import Helper Kompresi

const PiketAbsensiGlobal = () => {
  const [kelas, setKelas] = useState([]);
  const [selectedKelas, setSelectedKelas] = useState('');
  const [siswa, setSiswa] = useState([]);
  const [loading, setLoading] = useState(false);
  const [absensiHariIni, setAbsensiHariIni] = useState({});
  const [isLibur, setIsLibur] = useState(false);

  useEffect(() => {
    // 1. CEK HARI LIBUR
    const hariIni = new Date().getDay();
    if (hariIni === 0 || hariIni === 6) { 
      setIsLibur(true);
    } else {
      fetchKelas();
    }
  }, []);

  useEffect(() => {
    if (selectedKelas) fetchSiswaDanAbsen();
  }, [selectedKelas]);

  // 1. Ambil daftar kelas dari tabel master_kelas (Bukan dari tabel siswa)
  const fetchKelas = async () => {
    try {
      const { data, error } = await supabase
        .from('master_kelas')
        .select('id, nama_kelas')
        .order('nama_kelas', { ascending: true });
      
      if (error) throw error;
      setKelas(data || []);
    } catch (err) {
      console.error("Gagal ambil master kelas:", err.message);
    }
  };

  // 2. Ambil Siswa berdasarkan ID Kelas yang dipilih
  const fetchSiswaDanAbsen = async () => {
    setLoading(true);
    const hariIni = new Date().toISOString().split('T')[0];
    try {
      // FIX: Query siswa berdasarkan kelas_id
      const { data: dataSiswa, error: errSiswa } = await supabase
        .from('siswa')
        .select('*')
        .eq('kelas_id', selectedKelas) // selectedKelas sekarang isinya ID (angka)
        .eq('status_siswa', 'Aktif')
        .order('nama_siswa');

      if (errSiswa) throw errSiswa;

      // Ambil absen harian untuk kelas tersebut
      const { data: dataAbsen, error: errAbsen } = await supabase
        .from('absensi')
        .select(`
          siswa_id, 
          status, 
          jam_hadir,
          siswa!inner(kelas_id)
        `)
        .eq('tanggal', hariIni)
        .eq('siswa.kelas_id', selectedKelas);

      if (errAbsen) throw errAbsen;

      const mapping = {};
      dataAbsen?.forEach(a => { 
        mapping[a.siswa_id] = { status: a.status, jam: a.jam_hadir }; 
      });
      
      setSiswa(dataSiswa || []);
      setAbsensiHariIni(mapping);
    } catch (err) { 
      console.error("Gagal sinkron data piket:", err.message); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleStatusClick = async (siswaId, namaSiswa, status) => {
    const hariIni = new Date().toISOString().split('T')[0];
    
    let payload = { 
      siswa_id: siswaId, 
      tanggal: hariIni, 
      status: status,
      jam_hadir: null,
      bukti_url: null 
    };

    // LOGIKA 1: Kesiangan (PAKSA 24 JAM)
    if (status === 'Kesiangan') {
      const { value: jam } = await Swal.fire({
        title: 'Jam Kedatangan',
        html: `
          <div class="text-left">
            <p class="text-[10px] font-black uppercase text-gray-400 mb-2">Siswa: ${namaSiswa}</p>
            <input 
              type="time" 
              id="swal-input-time" 
              class="swal2-input !m-0 !w-full" 
              style="display: block; font-family: monospace;"
            >
          </div>
        `,
        focusConfirm: false,
        preConfirm: () => {
          const val = document.getElementById('swal-input-time').value;
          if (!val) return Swal.showValidationMessage('Jam wajib diisi!');
          return val;
        },
        confirmButtonText: 'Simpan',
        showCancelButton: true
      });
      if (!jam) return;
      payload.jam_hadir = jam;
    }

    // LOGIKA 2: Sakit/Izin (FIX: Support Galeri + AUTO COMPRESS)
    if (status === 'Sakit' || status === 'Izin') {
      const { value: file } = await Swal.fire({
        title: `Bukti ${status}`,
        input: 'file',
        inputAttributes: { 'accept': 'image/*' }, 
        inputLabel: `Pilih foto surat/bukti dari galeri untuk ${namaSiswa}`,
        showCancelButton: true,
        confirmButtonColor: '#2563eb'
      });

      if (file) {
        // FEEDBACK VISUAL: Kasih tahu Piket kalau lagi dikompres
        Swal.fire({ title: 'Mekompres & Mengunggah...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        
        try {
          // PROSES KOMPRES OTOMATIS KE ~110KB
          const compressedFile = await compressImage(file);
          
          const fileName = `${siswaId}-${Date.now()}.${file.name.split('.').pop()}`;
          
          const { error: uploadError } = await supabase.storage
            .from('bukti-absen')
            .upload(fileName, compressedFile); // Upload file hasil kompresi

          if (uploadError) throw uploadError;
          
          const { data: { publicUrl } } = supabase.storage
            .from('bukti-absen')
            .getPublicUrl(fileName);
            
          payload.bukti_url = publicUrl;
          Swal.close();
        } catch (err) {
          Swal.fire('Gagal', 'Gagal memproses gambar: ' + err.message, 'error');
          return;
        }
      } else {
        return; 
      }
    }

    // 3. Simpan ke Database (Upsert)
    try {
      const { error } = await supabase
        .from('absensi')
        .upsert(payload, { onConflict: 'siswa_id, tanggal' });

      if (error) throw error;

      setAbsensiHariIni(prev => ({ 
        ...prev, 
        [siswaId]: { status: status, jam: payload.jam_hadir } 
      }));
      
      Swal.fire({ icon: 'success', title: 'Data Dikoreksi!', timer: 1000, showConfirmButton: false });

    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'Gagal update: ' + err.message, 'error');
    }
  };

  if (isLibur) return (
    <div className="flex flex-col items-center justify-center p-20 text-center">
      <Coffee size={80} className="text-blue-200 mb-6" />
      <h2 className="text-2xl font-black text-gray-800 italic uppercase leading-none">Meja Piket Tutup</h2>
      <p className="text-gray-400 font-bold text-[10px] mt-4 uppercase tracking-[0.2em]">Koreksi absen hanya tersedia di hari sekolah.</p>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto p-4 pb-20 font-sans">
      <header className="mb-6">
        <h1 className="text-3xl font-black italic uppercase text-gray-800 tracking-tighter leading-none">Koreksi Absen Global</h1>
        <p className="text-blue-600 font-bold text-[10px] tracking-[0.3em] mt-2 uppercase">Akses Penanganan Piket Terpusat</p>
      </header>

      {/* FILTER KELAS */}
      <div className="bg-white p-5 rounded-[30px] border border-gray-100 shadow-sm mb-6">
        <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-2xl border border-gray-100">
          <Filter className="text-gray-400" size={18} />
          <select 
  className="bg-transparent outline-none font-bold text-xs text-gray-700 w-full cursor-pointer uppercase" 
  value={selectedKelas} 
  onChange={(e) => setSelectedKelas(e.target.value)}
>
  <option value="">-- PILIH KELAS UNTUK KOREKSI --</option>
  {/* FIX: Menggunakan k.id sebagai value dan k.nama_kelas sebagai label */}
  {kelas.map(k => (
    <option key={k.id} value={k.id}>
      KELAS {k.nama_kelas}
    </option>
  ))}
</select>
        </div>
      </div>

      {selectedKelas && (
        <div className="bg-white rounded-[35px] border border-gray-100 shadow-lg overflow-hidden">
          <div className="p-4 bg-gray-900 text-white flex justify-between items-center">
            <span className="text-[10px] font-black uppercase tracking-widest italic">Monitoring: {selectedKelas}</span>
            <div className="flex items-center gap-2">
               <UserCheck size={14} className="text-blue-400" />
               <span className="text-[8px] font-bold uppercase italic">Status Live</span>
            </div>
          </div>

          <div className="divide-y divide-gray-50">
            {loading ? (
              <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-blue-600" /></div>
            ) : (
              siswa.map((s, index) => {
                const dataAbsen = absensiHariIni[s.id];
                return (
                  <div key={s.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 font-black text-xs">{index + 1}</div>
                      <div>
                        <p className="text-[11px] font-black uppercase text-gray-800 leading-tight">{s.nama_siswa}</p>
                        <div className="flex items-center gap-2 mt-1">
                           <p className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter">NIS: {s.nis}</p>
                           {dataAbsen && (
                             <span className="text-[7px] font-black bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full uppercase italic">
                               Status Saat Ini: {dataAbsen.status} {dataAbsen.jam ? `(${dataAbsen.jam})` : ''}
                             </span>
                           )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {['Hadir', 'Sakit', 'Izin', 'Alpha', 'Kesiangan'].map((status) => (
                        <button
                          key={status}
                          onClick={() => handleStatusClick(s.id, s.nama_siswa, status)}
                          className={`px-4 py-2.5 rounded-xl text-[8px] font-black uppercase transition-all active:scale-95 flex items-center gap-1.5 ${
                            dataAbsen?.status === status 
                            ? (status === 'Alpha' ? 'bg-red-600 text-white shadow-lg' : status === 'Hadir' ? 'bg-green-600 text-white shadow-lg' : status === 'Kesiangan' ? 'bg-blue-600 text-white shadow-lg' : 'bg-amber-500 text-white shadow-lg')
                            : 'bg-gray-50 text-gray-400 hover:bg-gray-100 border border-transparent'
                          }`}
                        >
                          {status === 'Kesiangan' && <Clock size={10} />}
                          {(status === 'Sakit' || status === 'Izin') && <ImageIcon size={10} />}
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PiketAbsensiGlobal;