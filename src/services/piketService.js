import { supabase } from './supabase/client';

export const fetchMasterKelas = async () => {
  const { data, error } = await supabase
    .from('master_kelas')
    .select('id, nama_kelas')
    .order('nama_kelas', { ascending: true });

  if (error) throw error;
  return data || [];
};

export const searchSiswaAktif = async ({ searchTerm, filterKelas, limit = 40 }) => {
  let query = supabase.from('siswa').select('*, master_kelas (nama_kelas)').eq('status_siswa', 'Aktif');

  if (filterKelas) query = query.eq('kelas_id', filterKelas);
  if (searchTerm) query = query.ilike('nama_siswa', `%${searchTerm}%`);

  const { data, error } = await query.limit(limit);
  if (error) throw error;
  return data || [];
};

export const createLogPiket = async ({ siswaId, jenisLog, alasan, namaPiket }) => {
  const { error } = await supabase.from('log_piket').insert([
    {
      siswa_id: siswaId,
      jenis_log: jenisLog,
      alasan,
      nama_piket: namaPiket,
    },
  ]);

  if (error) throw error;
};

export const fetchPiketLogByTanggal = async (tanggal) => {
  const { data, error } = await supabase
    .from('log_piket')
    .select('*, siswa (nama_siswa, master_kelas (nama_kelas))')
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data || [])
    .map((log) => ({
      ...log,
      nama_siswa: log.siswa?.nama_siswa,
      nama_kelas: log.siswa?.master_kelas?.nama_kelas,
      tanggal_log: new Date(log.created_at).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }),
    }))
    .filter((log) => log.tanggal_log === tanggal);
};
