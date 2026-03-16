import { supabase } from './supabase/client';

export const fetchActiveStudentsByKelas = async (kelasId) => {
  const { data, error } = await supabase
    .from('siswa')
    .select('*')
    .eq('kelas_id', kelasId)
    .eq('status_siswa', 'Aktif')
    .order('nama_siswa', { ascending: true });

  if (error) throw error;
  return data || [];
};

export const fetchAbsensiByTanggal = async (tanggal) => {
  const { data, error } = await supabase
    .from('absensi')
    .select('siswa_id, status, bukti_url, jam_hadir')
    .eq('tanggal', tanggal);

  if (error) throw error;
  return data || [];
};

export const fetchAbsensiByTanggalDanKelas = async (tanggal, kelasId) => {
  const { data, error } = await supabase
    .from('absensi')
    .select(
      `
        siswa_id,
        status,
        jam_hadir,
        siswa!inner(kelas_id)
      `,
    )
    .eq('tanggal', tanggal)
    .eq('siswa.kelas_id', kelasId);

  if (error) throw error;
  return data || [];
};

export const upsertAbsensi = async (payload) => {
  const { error } = await supabase.from('absensi').upsert(payload, { onConflict: 'siswa_id, tanggal' });
  if (error) throw error;
};

export const upsertBulkAbsensi = async (entries) => {
  const { error } = await supabase.from('absensi').upsert(entries, { onConflict: 'siswa_id, tanggal' });
  if (error) throw error;
};
