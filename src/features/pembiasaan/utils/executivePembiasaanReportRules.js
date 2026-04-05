const normalizeStatus = (value) => String(value || '').trim().toLowerCase();
const normalizeString = (value) => String(value || '').trim();

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
