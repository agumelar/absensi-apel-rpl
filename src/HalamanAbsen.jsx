import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { 
  User, Loader2, Clock, CheckCircle, 
  Image as ImageIcon, Eye, Coffee 
} from 'lucide-react';
import { compressImage } from './utils/compressor'; 
import {
  fetchAbsensiByTanggal,
  fetchActiveStudentsByKelas,
  upsertBulkAbsensi,
} from './services/absensiService';
import { uploadBuktiAbsen } from './services/supabase/storageService';

const HalamanAbsen = ({ user }) => {
  const [siswa, setSiswa] = useState([]);
  const [loading, setLoading] = useState(true);
  const [absensi, setAbsensi] = useState({});
  const [sudahAbsenData, setSudahAbsenData] = useState({}); 
  const [isLibur, setIsLibur] = useState(false);

  useEffect(() => {
    const hariIni = new Date().getDay();
    // 0 = Minggu, 6 = Sabtu
    if (hariIni === 0 || hariIni === 6) { 
      setIsLibur(true);
      setLoading(false);
    } else if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const tanggalHariIni = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
      
      // FIX 1: Gunakan kelas_id dari data user yang login
      const kelasIdTarget = user?.kelas_id;

      if (!kelasIdTarget) {
        console.error("User tidak memiliki akses kelas (Admin/Piket)");
        setLoading(false);
        return;
      }

      // FIX 2: Query siswa berdasarkan kelas_id (bukan teks 'kelas')
      const dataSiswa = await fetchActiveStudentsByKelas(kelasIdTarget);

      // FIX 3: Query absensi hari ini dengan relasi yang benar
      const dataAbsen = await fetchAbsensiByTanggal(tanggalHariIni);

      const mapAbsen = {};
      dataAbsen.forEach(item => {
        mapAbsen[item.siswa_id] = { 
          status: item.status, 
          bukti_url: item.bukti_url,
          jam_hadir: item.jam_hadir 
        };
      });

      setSiswa(dataSiswa || []);
      setSudahAbsenData(mapAbsen);
    } catch (error) {
      console.error("Gagal ambil data:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStatus = async (siswaId, status) => {
    if (status === 'Kesiangan') {
      const { value: jam } = await Swal.fire({
        title: 'Jam Kedatangan',
        html: '<input type="time" id="swal-input-jam" class="swal2-input" step="60">',
        confirmButtonColor: '#2563eb',
        preConfirm: () => document.getElementById('swal-input-jam').value
      });
      if (jam) setAbsensi({ ...absensi, [siswaId]: { status, jam_hadir: jam } });
      return;
    }

    if (['Sakit', 'Izin'].includes(status)) {
      const { value: file } = await Swal.fire({
        title: `Bukti ${status}`,
        input: 'file',
        inputAttributes: { 'accept': 'image/*' },
        showCancelButton: true,
        confirmButtonColor: '#2563eb',
      });

      if (file) {
        Swal.fire({ title: 'Mengompres & Mengunggah...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        
        try {
          const compressedFile = await compressImage(file);
          const fileName = `${status}-${siswaId}-${Date.now()}.jpg`;
          
          const publicUrl = await uploadBuktiAbsen(fileName, compressedFile);
          setAbsensi({ ...absensi, [siswaId]: { status, bukti_url: publicUrl } });
          Swal.close();
        } catch (err) {
          Swal.fire('Gagal', 'Gagal memproses gambar: ' + err.message, 'error');
        }
      }
      return;
    }

    setAbsensi({ ...absensi, [siswaId]: { status } });
  };

  const handleSimpanAbsensi = async () => {
    try {
      setLoading(true);
      const dataSiapSimpan = Object.keys(absensi).map((siswaId) => ({
        siswa_id: siswaId,
        status: absensi[siswaId].status,
        tanggal: new Date().toISOString().split('T')[0],
        jam_hadir: absensi[siswaId].jam_hadir || null,
        bukti_url: absensi[siswaId].bukti_url || null
      }));

      // Pake upsert biar kalo ada perubahan (re-absen) bisa update otomatis
      await upsertBulkAbsensi(dataSiapSimpan);

      await Swal.fire({ icon: 'success', title: 'Absensi Tersimpan!', confirmButtonColor: '#2563eb', timer: 1000, showConfirmButton: false });
      setAbsensi({});
      fetchData();
    } catch (err) {
      Swal.fire('Error', 'Gagal menyimpan data: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // --- Tampilan UI (Tidak Berubah) ---
  if (loading) return (
    <div className="flex flex-col items-center justify-center p-20">
      <Loader2 className="animate-spin text-blue-600 mb-4" size={40} />
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Menyiapkan Daftar Siswa...</p>
    </div>
  );

  if (isLibur) return (
    <div className="flex flex-col items-center justify-center p-20 text-center">
      <Coffee size={80} className="text-blue-200 mb-6" />
      <h2 className="text-2xl font-black text-gray-800 italic uppercase leading-none">Selamat Berlibur!</h2>
      <p className="text-gray-400 font-bold text-[10px] mt-4 uppercase tracking-[0.2em]">Selamat Menikmati Hari Libur Anda :D</p>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto pb-32 p-4 font-sans">
      <header className="mb-8">
        <h1 className="text-3xl font-black italic uppercase tracking-tighter leading-none">ABSENSI HARIAN</h1>
        <p className="text-blue-600 font-bold text-[10px] uppercase tracking-[0.3em] mt-2">
          {user?.kelas_diampu || 'KELAS TIDAK TERDETEKSI'} • {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </header>

      <div className="space-y-4">
        {siswa.length === 0 ? (
           <div className="p-20 text-center border-2 border-dashed border-gray-100 rounded-[40px]">
             <p className="text-[10px] font-black text-gray-300 uppercase italic">Belum ada siswa di kelas ini.</p>
           </div>
        ) : (
          siswa.map((item) => {
            const dataSdhAbsen = sudahAbsenData[item.id];
            const isLocked = !!dataSdhAbsen;
            const statusTerpilih = isLocked ? dataSdhAbsen.status : absensi[item.id]?.status;

            return (
              <div key={item.id} className={`p-5 rounded-[35px] border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${isLocked ? 'bg-gray-50/50 border-gray-100 opacity-80' : 'bg-white border-gray-100 shadow-sm'}`}>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-gray-800 text-xs uppercase">{item.nama_siswa}</h3>
                    {isLocked && <CheckCircle size={14} className="text-green-500" />}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-[9px] text-gray-400 font-bold tracking-tighter uppercase">
                      NIS: {item.nis} {isLocked && `• ${dataSdhAbsen.jam_hadir || 'Tercatat'} • TERKUNCI`}
                    </p>
                  </div>
                  
                  {(dataSdhAbsen?.bukti_url || absensi[item.id]?.bukti_url) && (
                    <button 
                      onClick={() => Swal.fire({ imageUrl: dataSdhAbsen?.bukti_url || absensi[item.id]?.bukti_url, imageAlt: 'Bukti Absen', showConfirmButton: false })}
                      className="mt-2 flex items-center gap-1 text-[9px] font-black text-blue-600 uppercase"
                    >
                      <Eye size={12} /> Cek Bukti Fisik
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {['Hadir', 'Sakit', 'Izin', 'Kesiangan', 'Alpha'].map((status) => {
                    const isActive = statusTerpilih === status;
                    const colorMap = { Hadir: 'bg-green-500', Sakit: 'bg-orange-500', Izin: 'bg-blue-600', Kesiangan: 'bg-amber-500', Alpha: 'bg-red-600' };

                    return (
                      <button
                        key={status}
                        disabled={isLocked || loading}
                        onClick={() => handleStatus(item.id, status)}
                        className={`px-3 py-2 rounded-xl text-[9px] font-black transition-all ${
                          isActive 
                            ? `${colorMap[status]} text-white shadow-lg scale-105` 
                            : isLocked 
                              ? 'bg-gray-100 text-gray-200 cursor-not-allowed' 
                              : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                        }`}
                      >
                        {status.toUpperCase()}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {Object.keys(absensi).length > 0 && (
        <div className="fixed bottom-8 left-0 right-0 px-4 flex justify-center z-50 animate-in slide-in-from-bottom-10">
          <button onClick={handleSimpanAbsensi} className="w-full max-w-md py-5 bg-blue-600 text-white rounded-[25px] font-black text-xs tracking-[0.2em] shadow-2xl active:scale-95 uppercase">
            SIMPAN {Object.keys(absensi).length} ENTRY BARU
          </button>
        </div>
      )}
    </div>
  );
};

export default HalamanAbsen;
