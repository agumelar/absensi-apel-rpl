const normalizeStatus = (value) => String(value || '').trim().toLowerCase();
const normalizeString = (value) => String(value || '').trim();

export const PEMBIASAAN_REPORT_START_DATE = '2026-07-20';

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

export const formatPembiasaanActivityLabel = formatActivityLabel;
export const formatPembiasaanStatusLabel = formatStatusLabel;
export const formatPembiasaanRoleLabel = formatRoleLabel;

export const resolvePembiasaanReportPeriod = ({
  fromDate,
  toDate,
  today,
  startDate = PEMBIASAAN_REPORT_START_DATE,
} = {}) => {
  const safeToday = normalizeString(today);
  const requestedFrom = normalizeString(fromDate) || safeToday;
  const requestedTo = normalizeString(toDate) || safeToday;
  const effectiveFrom = requestedFrom > startDate ? requestedFrom : startDate;
  const effectiveTo = requestedTo < safeToday ? requestedTo : safeToday;

  return {
    requestedFrom,
    requestedTo,
    fromDate: effectiveFrom,
    toDate: effectiveTo,
    isEmpty: !effectiveFrom || !effectiveTo || effectiveFrom > effectiveTo,
  };
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
    Sumber: row?.created_by_system ? 'Otomatis' : 'Dilaporkan',
    Catatan: normalizeString(row?.note) || '-',
  }));

export const buildDetailHistoryExportRows = (rows = []) =>
  (rows || []).map((row) => ({
    Tanggal: normalizeString(row?.tanggal) || '-',
    Aktivitas: formatActivityLabel(row?.activity_type),
    Nama: normalizeString(row?.nama_lengkap) || '-',
    Status: formatStatusLabel(row?.status),
    Jam: formatCheckinAtToWIB(row?.checkin_at),
    Foto: normalizeString(row?.photo_path) || '-',
    'Jarak (m)': row?.distance_meter ?? '-',
    'Sumber Bukti': formatEvidenceSourceLabel(row?.evidence_source),
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
  alpha_otomatis: 0,
  total_aktual: 0,
  total_kewajiban: 0,
  pelaporan_valid: 0,
  belum_tercatat: 0,
  perlu_perhatian: 0,
  kehadiran_persen: 0,
  pelaporan_valid_persen: 0,
  perhatian_persen: 0,
  kepatuhan_persen: 0,
});

const toBoundedPercentage = (value, denominator) => {
  if (denominator <= 0) return 0;
  return Math.min(100, Math.round((Number(value || 0) / denominator) * 10000) / 100);
};

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
    else if (status === 'alpha') {
      recap.alpha += 1;
      if (row.created_by_system) recap.alpha_otomatis += 1;
    }
  });

  const results = Array.from(recapMap.values()).map((item) => {
    const totalAktual = item.hadir + item.izin + item.sakit + item.alpha;
    const totalKewajiban = Number(obligationsByUserId[item.user_id] || 0);
    const pelaporanValid = item.hadir + item.izin + item.sakit;
    const belumTercatat = Math.max(totalKewajiban - totalAktual, 0);
    const perluPerhatian = item.alpha + belumTercatat;
    const kehadiranPersen = toBoundedPercentage(item.hadir, totalKewajiban);
    const pelaporanValidPersen = toBoundedPercentage(pelaporanValid, totalKewajiban);
    const perhatianPersen = toBoundedPercentage(perluPerhatian, totalKewajiban);

    return {
      ...item,
      total_aktual: totalAktual,
      total_kewajiban: totalKewajiban,
      pelaporan_valid: pelaporanValid,
      belum_tercatat: belumTercatat,
      perlu_perhatian: perluPerhatian,
      kehadiran_persen: kehadiranPersen,
      pelaporan_valid_persen: pelaporanValidPersen,
      perhatian_persen: perhatianPersen,
      kepatuhan_persen: pelaporanValidPersen,
    };
  });

  return results.sort((a, b) => {
    if (b.perlu_perhatian !== a.perlu_perhatian) return b.perlu_perhatian - a.perlu_perhatian;
    if (a.pelaporan_valid_persen !== b.pelaporan_valid_persen) return a.pelaporan_valid_persen - b.pelaporan_valid_persen;
    return normalizeString(a.nama_lengkap).localeCompare(normalizeString(b.nama_lengkap));
  });
};

export const summarizeTeacherRecapRows = (rows = []) => {
  const summary = (rows || []).reduce(
    (acc, row) => {
      const obligations = Number(row?.total_kewajiban || 0);
      if (obligations > 0) acc.scheduledParticipants += 1;
      acc.obligations += obligations;
      acc.hadir += Number(row?.hadir || 0);
      acc.izin += Number(row?.izin || 0);
      acc.sakit += Number(row?.sakit || 0);
      acc.alpha += Number(row?.alpha || 0);
      acc.validReports += Number(row?.pelaporan_valid || 0);
      acc.missingUnrecorded += Number(row?.belum_tercatat || 0);
      acc.needsAttention += Number(row?.perlu_perhatian || 0);
      return acc;
    },
    {
      scheduledParticipants: 0,
      obligations: 0,
      hadir: 0,
      izin: 0,
      sakit: 0,
      alpha: 0,
      validReports: 0,
      missingUnrecorded: 0,
      needsAttention: 0,
    },
  );

  summary.validReportRate =
    summary.obligations > 0
      ? Math.min(100, Math.round((summary.validReports / summary.obligations) * 1000) / 10)
      : 0;
  summary.presenceRate =
    summary.obligations > 0 ? Math.min(100, Math.round((summary.hadir / summary.obligations) * 1000) / 10) : 0;

  return summary;
};

export const reconcileObligationsWithActualRows = ({ rows = [], obligationsByUserId = {} } = {}) => {
  const reconciled = Object.fromEntries(
    Object.entries(obligationsByUserId || {}).map(([userId, count]) => [String(userId), Number(count || 0)]),
  );
  const actualCountByUserId = {};

  (rows || []).forEach((row) => {
    const userId = String(row?.user_id || '');
    if (!userId) return;
    actualCountByUserId[userId] = Number(actualCountByUserId[userId] || 0) + 1;
  });

  Object.entries(actualCountByUserId).forEach(([userId, actualCount]) => {
    reconciled[userId] = Math.max(Number(reconciled[userId] || 0), Number(actualCount || 0));
  });

  return reconciled;
};

export const buildTeacherRecapExportRows = (rows = []) =>
  (rows || []).map((row, index) => ({
    Peringkat: index + 1,
    Nama: normalizeString(row?.nama_lengkap) || '-',
    Role: formatRoleLabel(row?.role),
    Hadir: Number(row?.hadir || 0),
    Izin: Number(row?.izin || 0),
    Sakit: Number(row?.sakit || 0),
    Alpha: Number(row?.alpha || 0),
    'Belum Tercatat': Number(row?.belum_tercatat || 0),
    'Perlu Perhatian': Number(row?.perlu_perhatian || 0),
    'Sudah Melapor': Number(row?.pelaporan_valid || 0),
    Kewajiban: Number(row?.total_kewajiban || 0),
    'Kehadiran (%)': Number(row?.kehadiran_persen || 0),
    'Sudah Melapor (%)': Number(row?.pelaporan_valid_persen || 0),
  }));
