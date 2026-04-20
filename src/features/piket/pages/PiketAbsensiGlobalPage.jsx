import React, { useCallback, useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import { Filter, Loader2, Clock, Image as ImageIcon, Coffee, UserCheck } from 'lucide-react';
import { compressImage } from '../../../shared/utils/compressor';
import {
  getCurrentTimeHHMMWIB,
  normalizeAttendanceTimeInput,
  toAttendanceTimeForDb,
} from '../../../shared/utils/attendanceTime';
import { getTodayDateWIB } from '../../../services/shared/dateService';
import { fetchMasterKelas } from '../../../services/piketService';
import {
  fetchAbsensiByTanggalDanKelas,
  fetchActiveStudentsByKelas,
  upsertAbsensi,
} from '../../../services/absensiService';
import { uploadBuktiAbsen } from '../../../services/supabase/storageService';
import { ATTENDANCE_DAY_OFF_MESSAGE, getAttendanceDayStatus } from '../../../services/shared/attendanceDayService';

const PiketAbsensiGlobal = () => {
  const [kelas, setKelas] = useState([]);
  const [selectedKelas, setSelectedKelas] = useState('');
  const [siswa, setSiswa] = useState([]);
  const [loading, setLoading] = useState(false);
  const [absensiHariIni, setAbsensiHariIni] = useState({});
  const [isLibur, setIsLibur] = useState(false);

  const defaultLateTimeValue = getCurrentTimeHHMMWIB();

  useEffect(() => {
    let isCancelled = false;
    const initPage = async () => {
      try {
        const dayStatus = await getAttendanceDayStatus({});
        if (isCancelled) return;

        if (!dayStatus.isActive) {
          setIsLibur(true);
          setKelas([]);
          setSelectedKelas('');
          setSiswa([]);
          setAbsensiHariIni({});
          return;
        }

        setIsLibur(false);
        await fetchKelas();
      } catch (error) {
        if (isCancelled) return;
        console.error('Gagal cek hari aktif absensi:', error.message);
      }
    };

    initPage();

    return () => {
      isCancelled = true;
    };
  }, []);

  const fetchKelas = async () => {
    try {
      const data = await fetchMasterKelas();
      setKelas(data);
    } catch (err) {
      console.error("Gagal ambil master kelas:", err.message);
    }
  };

  const fetchSiswaDanAbsen = useCallback(async () => {
    setLoading(true);
    const hariIni = getTodayDateWIB(); // GANTI KE WIB
    try {
      const [dataSiswa, dataAbsen] = await Promise.all([
        fetchActiveStudentsByKelas(selectedKelas),
        fetchAbsensiByTanggalDanKelas(hariIni, selectedKelas),
      ]);

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
  }, [selectedKelas]);

  useEffect(() => {
    if (selectedKelas) fetchSiswaDanAbsen();
  }, [fetchSiswaDanAbsen, selectedKelas]);

  const handleStatusClick = async (siswaId, namaSiswa, status) => {
    const hariIni = getTodayDateWIB(); // GANTI KE WIB
    
    let payload = { 
      siswa_id: siswaId, 
      tanggal: hariIni, 
      status: status,
      jam_hadir: null,
      bukti_url: null 
    };

    if (status === 'Kesiangan') {
      const { value: jam } = await Swal.fire({
        title: 'Jam Kedatangan',
        text: `Siswa: ${namaSiswa}`,
        input: 'time',
        inputLabel: 'Pilih jam kedatangan',
        inputValue: defaultLateTimeValue,
        customClass: {
          popup: 'swal-time-picker-popup',
          input: 'swal-time-picker-input',
        },
        inputAttributes: {
          step: '60',
          autocapitalize: 'off',
          autocomplete: 'off',
          autocorrect: 'off',
        },
        preConfirm: (value) => {
          const normalized = normalizeAttendanceTimeInput(value);
          if (!normalized) {
            Swal.showValidationMessage('Format jam tidak valid. Gunakan HH:mm (contoh 07:35).');
            return null;
          }
          return normalized;
        },
        confirmButtonText: 'Simpan',
        showCancelButton: true
      });

      const jamHadir = toAttendanceTimeForDb(jam);
      if (!jamHadir) return;
      payload.jam_hadir = jamHadir;
    }

    if (status === 'Sakit' || status === 'Izin') {
      const { value: file } = await Swal.fire({
        title: `Bukti ${status}`,
        input: 'file',
        inputAttributes: { 'accept': 'image/*' }, 
        inputLabel: `Pilih foto surat/bukti untuk ${namaSiswa}`,
        showCancelButton: true,
        confirmButtonColor: '#2563eb'
      });

      if (file) {
        Swal.fire({ title: 'Mekompres & Mengunggah...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        try {
          const compressedFile = await compressImage(file);
          const fileName = `${siswaId}-${Date.now()}.${file.name.split('.').pop()}`;
          payload.bukti_url = await uploadBuktiAbsen(fileName, compressedFile);
          Swal.close();
        } catch (err) {
          Swal.fire('Gagal', 'Gagal memproses gambar: ' + err.message, 'error');
          return;
        }
      } else return;
    }

    try {
      await upsertAbsensi(payload);
      setAbsensiHariIni(prev => ({ ...prev, [siswaId]: { status: status, jam: payload.jam_hadir } }));
      Swal.fire({ icon: 'success', title: 'Data Dikoreksi!', timer: 1000, showConfirmButton: false });
    } catch (err) {
      console.error(err);
      Swal.fire('Error', 'Gagal update: ' + err.message, 'error');
    }
  };

  if (isLibur) return (
    <div className="flex flex-col items-center justify-center p-20 text-center">
      <Coffee size={80} className="text-blue-200 mb-6" />
      <p className="text-sm font-black text-gray-700 uppercase tracking-wide">{ATTENDANCE_DAY_OFF_MESSAGE}</p>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto p-4 pb-20 font-sans text-left">
      <header className="mb-6">
        <h1 className="text-3xl font-black italic uppercase text-gray-800 tracking-tighter leading-none text-left">Koreksi Absen Global</h1>
        <p className="text-blue-600 font-bold text-[10px] tracking-[0.3em] mt-2 uppercase text-left">Akses Penanganan Piket Terpusat</p>
      </header>

      <div className="bg-white p-5 rounded-[30px] border border-gray-100 shadow-sm mb-6">
        <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-2xl border border-gray-100">
          <Filter className="text-gray-400" size={18} />
          <select className="bg-transparent outline-none font-bold text-xs text-gray-700 w-full cursor-pointer uppercase" value={selectedKelas} onChange={(e) => setSelectedKelas(e.target.value)}>
            <option value="">-- PILIH KELAS UNTUK KOREKSI --</option>
            {kelas.map(k => <option key={k.id} value={k.id}>KELAS {k.nama_kelas}</option>)}
          </select>
        </div>
      </div>

      {selectedKelas && (
        <div className="bg-white rounded-[35px] border border-gray-100 shadow-lg overflow-hidden">
          <div className="p-4 bg-gray-900 text-white flex justify-between items-center">
            <span className="text-[10px] font-black uppercase tracking-widest italic">Monitoring: {kelas.find(k => k.id === parseInt(selectedKelas))?.nama_kelas}</span>
            <div className="flex items-center gap-2"><UserCheck size={14} className="text-blue-400" /><span className="text-[8px] font-bold uppercase italic text-left">Status Live</span></div>
          </div>

          <div className="divide-y divide-gray-50">
            {loading ? (
              <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-blue-600" /></div>
            ) : (
              siswa.map((s, index) => {
                const dataAbsen = absensiHariIni[s.id];
                return (
                  <div key={s.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-left">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 font-black text-xs">{index + 1}</div>
                      <div className="text-left">
                        <p className="text-[11px] font-black uppercase text-gray-800 leading-tight text-left">{s.nama_siswa}</p>
                        <div className="flex items-center gap-2 mt-1">
                           <p className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter text-left">NIS: {s.nis}</p>
                           {dataAbsen && (
                             <span className="text-[7px] font-black bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full uppercase italic">Status Saat Ini: {dataAbsen.status} {dataAbsen.jam ? `(${dataAbsen.jam})` : ''}</span>
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
