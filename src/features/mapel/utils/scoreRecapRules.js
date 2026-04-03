const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const isValidIsoDate = (value) => {
  if (!ISO_DATE_REGEX.test(value)) return false;

  const [yearRaw, monthRaw, dayRaw] = value.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
};

const normalizeIsoDate = (value) => {
  const normalized = String(value || '').trim();

  if (!isValidIsoDate(normalized)) {
    throw new Error('Tanggal tidak valid.');
  }

  return normalized;
};

export const buildPeriodRange = ({ mode = 'monthly', anchorDate, fromDate, toDate } = {}) => {
  const normalizedMode = String(mode || 'monthly').trim().toLowerCase();

  if (normalizedMode === 'range') {
    const start = normalizeIsoDate(fromDate);
    const end = normalizeIsoDate(toDate);

    if (start > end) {
      throw new Error('Rentang tanggal tidak valid.');
    }

    return { fromDate: start, toDate: end, label: 'Rentang tanggal' };
  }

  const day = normalizeIsoDate(anchorDate);

  if (normalizedMode === 'today') {
    return { fromDate: day, toDate: day, label: 'Hari ini' };
  }

  const monthStart = `${day.slice(0, 8)}01`;
  return { fromDate: monthStart, toDate: day, label: 'Bulanan' };
};

export const buildScoreRecapRows = ({ students, sessionIds, scoreRows } = {}) => {
  const safeStudents = Array.isArray(students) ? students : [];
  const safeSessions = Array.isArray(sessionIds) ? sessionIds : [];
  const safeScoreRows = Array.isArray(scoreRows) ? scoreRows : [];
  const totalPertemuan = safeSessions.length;

  const scoreMap = new Map();
  safeScoreRows.forEach((row) => {
    const key = `${row.session_id}:${row.siswa_id}`;
    scoreMap.set(key, Number(row.nilai));
  });

  return safeStudents.map((student) => {
    let frekuensiDinilai = 0;
    let totalPoin = 0;

    safeSessions.forEach((sessionId) => {
      const score = scoreMap.get(`${sessionId}:${student.id}`);
      if (!Number.isFinite(score)) return;
      frekuensiDinilai += 1;
      totalPoin += score;
    });

    const coveragePersen =
      totalPertemuan > 0 ? Math.round((frekuensiDinilai / totalPertemuan) * 1000) / 10 : 0;
    const rataRataSaatDinilai =
      frekuensiDinilai > 0 ? Math.round((totalPoin / frekuensiDinilai) * 10) / 10 : null;

    return {
      siswa_id: student.id,
      nama_siswa: student.nama_siswa || '-',
      nis: student.nis || '-',
      total_pertemuan: totalPertemuan,
      frekuensi_dinilai: frekuensiDinilai,
      coverage_persen: coveragePersen,
      total_poin: totalPoin,
      rata_rata_saat_dinilai: rataRataSaatDinilai,
      keterangan: frekuensiDinilai > 0 ? 'Sudah pernah dinilai' : 'Belum pernah dinilai',
    };
  });
};

export const summarizeScoreRecapRows = (rows) => {
  const safeRows = Array.isArray(rows) ? rows : [];
  const totalSiswa = safeRows.length;
  const siswaDinilai = safeRows.filter((row) => Number(row?.frekuensi_dinilai || 0) > 0).length;
  const totalCoverage = safeRows.reduce((sum, row) => sum + Number(row?.coverage_persen || 0), 0);

  return {
    totalSiswa,
    siswaDinilai,
    siswaBelumDinilai: Math.max(0, totalSiswa - siswaDinilai),
    rataRataCoverage: totalSiswa > 0 ? Math.round((totalCoverage / totalSiswa) * 10) / 10 : 0,
  };
};

export const buildScoreRecapExcelDataRows = (rows) => {
  const safeRows = Array.isArray(rows) ? rows : [];

  return safeRows.map((row, index) => ({
    No: index + 1,
    Nama: row.nama_siswa || '-',
    NIS: row.nis || '-',
    'Total Pertemuan': Number(row.total_pertemuan || 0),
    'Frekuensi Dinilai': Number(row.frekuensi_dinilai || 0),
    'Cakupan Penilaian (%)': Number(row.coverage_persen || 0),
    'Total Poin': Number(row.total_poin || 0),
    'Rata-rata Saat Diberi Nilai':
      row.rata_rata_saat_dinilai === null ? '-' : Number(row.rata_rata_saat_dinilai || 0),
    Keterangan: row.keterangan || '-',
  }));
};

export const buildRecapRequestPeriod = ({ mode = 'monthly', anchorDate, fromDate, toDate } = {}) => {
  const normalizedMode = String(mode || 'monthly').trim().toLowerCase();
  const safeMode = ['today', 'monthly', 'range'].includes(normalizedMode) ? normalizedMode : 'monthly';

  if (safeMode === 'range') {
    return {
      periodMode: safeMode,
      fromDate,
      toDate,
    };
  }

  return {
    periodMode: safeMode,
    anchorDate,
  };
};

export const formatRecapPeriodLabel = (period) => {
  const baseLabel = String(period?.label || 'Periode').trim();
  const fromDate = String(period?.fromDate || '').trim();
  const toDate = String(period?.toDate || '').trim();

  if (fromDate && toDate) {
    return `${baseLabel}: ${fromDate} s/d ${toDate}`;
  }

  return baseLabel;
};
