const normalizeStatus = (value) => String(value || '').trim().toLowerCase();
const normalizeString = (value) => String(value || '').trim();

const ACTIVITY_LABEL_MAP = {
  sapa_pagi: 'Sapa Pagi',
  pembiasaan: 'Pembiasaan',
};

const STATUS_LABEL_MAP = {
  hadir: 'Hadir',
  izin: 'Izin',
  sakit: 'Sakit',
  alpha: 'Alpha',
};

const ROLE_LABEL_MAP = {
  guru: 'Guru',
  guru_mapel: 'Guru Mapel',
  tu: 'TU',
  walikelas: 'Wali Kelas',
  walas: 'Wali Kelas',
  piket: 'Piket',
  kepsek: 'Kepsek',
  kesiswaan: 'Kesiswaan',
  kaprog: 'Kaprog',
  kurikulum: 'Kurikulum',
  admin: 'Admin',
};

const EVIDENCE_SOURCE_LABEL_MAP = {
  rear_camera: 'Kamera Belakang',
  front_camera: 'Kamera Depan',
  upload: 'Upload',
  gallery: 'Galeri',
};

const toTitleWords = (value) => {
  const safeValue = normalizeString(value).replace(/[_-]+/g, ' ');
  if (!safeValue) return '-';
  return safeValue
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const formatActivityLabel = (value) => {
  const normalized = normalizeStatus(value);
  if (!normalized) return '-';
  return ACTIVITY_LABEL_MAP[normalized] || toTitleWords(normalized);
};

const formatStatusLabel = (value) => {
  const normalized = normalizeStatus(value);
  if (!normalized) return '-';
  return STATUS_LABEL_MAP[normalized] || toTitleWords(normalized);
};

const formatRoleLabel = (value) => {
  const normalized = normalizeStatus(value);
  if (!normalized) return '-';
  return ROLE_LABEL_MAP[normalized] || toTitleWords(normalized);
};

const formatYesNoLabel = (value) => (value ? 'Ya' : 'Tidak');

const formatEvidenceSourceLabel = (value) => {
  const normalized = normalizeStatus(value);
  if (!normalized) return '-';
  return EVIDENCE_SOURCE_LABEL_MAP[normalized] || toTitleWords(normalized);
};

const wibHourMinuteFormatter = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export const formatCheckinAtToWIB = (value) => {
  const safeValue = normalizeString(value);
  if (!safeValue) return '-';
  if (/^\d{2}:\d{2}$/.test(safeValue)) return safeValue;

  const parsed = new Date(safeValue);
  if (Number.isNaN(parsed.getTime())) return '-';

  return wibHourMinuteFormatter.format(parsed).replace('.', ':');
};

const compareMonitoringRows = (a, b) => {
  if (a.checkin_at && b.checkin_at) {
    if (a.checkin_at === b.checkin_at) return normalizeString(a.nama_lengkap).localeCompare(normalizeString(b.nama_lengkap));
    return a.checkin_at.localeCompare(b.checkin_at);
  }
  if (a.checkin_at && !b.checkin_at) return -1;
  if (!a.checkin_at && b.checkin_at) return 1;
  return normalizeString(a.nama_lengkap).localeCompare(normalizeString(b.nama_lengkap));
};

export const buildDailyMonitoringRows = (rows = [], { focusDate, status = 'all' } = {}) => {
  const targetDate = normalizeString(focusDate);
  const targetStatus = normalizeStatus(status);

  return (rows || [])
    .filter((row) => {
      if (targetDate && normalizeString(row.tanggal) !== targetDate) return false;
      if (targetStatus && targetStatus !== 'all' && normalizeStatus(row.status) !== targetStatus) return false;
      return true;
    })
    .sort(compareMonitoringRows);
};

export const buildDailyMonitoringExportRows = (rows = []) =>
  (rows || []).map((row) => ({
    Tanggal: normalizeString(row?.tanggal) || '-',
    Aktivitas: formatActivityLabel(row?.activity_type),
    Nama: normalizeString(row?.nama_lengkap) || '-',
    Role: formatRoleLabel(row?.role),
    Status: formatStatusLabel(row?.status),
    Jam: formatCheckinAtToWIB(row?.checkin_at),
    'Jarak (m)': row?.distance_meter ?? '-',
    Catatan: normalizeString(row?.note) || '-',
  }));

export const buildDetailHistoryExportRows = (rows = []) =>
  (rows || []).map((row) => ({
    ID: row?.id ?? '-',
    Tanggal: normalizeString(row?.tanggal) || '-',
    Aktivitas: formatActivityLabel(row?.activity_type),
    'ID User': normalizeString(row?.user_id) || '-',
    Nama: normalizeString(row?.nama_lengkap) || '-',
    Role: formatRoleLabel(row?.role),
    'ID Jurusan': row?.jurusan_id_snapshot ?? '-',
    Jurusan: normalizeString(row?.nama_jurusan) || '-',
    Status: formatStatusLabel(row?.status),
    Jam: formatCheckinAtToWIB(row?.checkin_at),
    Catatan: normalizeString(row?.note) || '-',
    Foto: normalizeString(row?.photo_path) || '-',
    'Ukuran Foto (KB)': row?.photo_size_kb ?? '-',
    Latitude: row?.lat ?? '-',
    Longitude: row?.lng ?? '-',
    'Jarak (m)': row?.distance_meter ?? '-',
    'Dalam Radius': row?.is_within_radius == null ? '-' : formatYesNoLabel(row.is_within_radius),
    'Sumber Bukti': formatEvidenceSourceLabel(row?.evidence_source),
    'Dibuat Sistem': formatYesNoLabel(Boolean(row?.created_by_system)),
    'Waktu Dibuat': normalizeString(row?.created_at) || '-',
    'Waktu Diperbarui': normalizeString(row?.updated_at) || '-',
  }));

const buildParticipantMap = (participants = []) => {
  const map = new Map();
  (participants || []).forEach((item) => {
    const key = normalizeString(item.id);
    if (!key) return;
    map.set(key, {
      user_id: key,
      nama_lengkap: normalizeString(item.nama_lengkap) || '-',
      role: normalizeString(item.role) || '-',
    });
  });
  return map;
};

const createEmptyRecap = (seed = {}) => ({
  user_id: seed.user_id || '',
  nama_lengkap: seed.nama_lengkap || '-',
  role: seed.role || '-',
  hadir: 0,
  izin: 0,
  sakit: 0,
  alpha: 0,
  total_aktual: 0,
  total_kewajiban: 0,
  kepatuhan_persen: 0,
});

export const buildTeacherRecapRows = ({ rows = [], participants = [], obligationsByUserId = {} } = {}) => {
  const participantMap = buildParticipantMap(participants);
  const recapMap = new Map();

  participantMap.forEach((seed, key) => {
    recapMap.set(key, createEmptyRecap(seed));
  });

  (rows || []).forEach((row) => {
    const userId = normalizeString(row.user_id);
    if (!userId) return;

    if (!recapMap.has(userId)) {
      recapMap.set(
        userId,
        createEmptyRecap({
          user_id: userId,
          nama_lengkap: normalizeString(row.nama_lengkap) || '-',
          role: normalizeString(row.role) || '-',
        }),
      );
    }

    const recap = recapMap.get(userId);
    const status = normalizeStatus(row.status);
    if (status === 'hadir') recap.hadir += 1;
    else if (status === 'izin') recap.izin += 1;
    else if (status === 'sakit') recap.sakit += 1;
    else if (status === 'alpha') recap.alpha += 1;
  });

  const results = Array.from(recapMap.values()).map((item) => {
    const totalAktual = item.hadir + item.izin + item.sakit + item.alpha;
    const totalKewajiban = Number(obligationsByUserId[item.user_id] || 0);
    const kepatuhan = totalKewajiban > 0 ? Math.round((totalAktual / totalKewajiban) * 10000) / 100 : 0;

    return {
      ...item,
      total_aktual: totalAktual,
      total_kewajiban: totalKewajiban,
      kepatuhan_persen: kepatuhan,
    };
  });

  return results.sort((a, b) => {
    if (b.alpha !== a.alpha) return b.alpha - a.alpha;
    return normalizeString(a.nama_lengkap).localeCompare(normalizeString(b.nama_lengkap));
  });
};
