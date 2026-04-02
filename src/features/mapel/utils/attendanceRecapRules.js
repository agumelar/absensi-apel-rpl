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

const normalizeStatus = (status) => {
  const value = String(status || '').trim().toUpperCase();

  if (value === 'HADIR' || value === 'H') return 'H';
  if (value === 'SAKIT' || value === 'S') return 'S';
  if (value === 'IZIN' || value === 'I') return 'I';
  if (value === 'ALPHA' || value === 'A') return 'A';

  return null;
};

export const buildStudentRecapRows = ({ students, sessionIds, attendanceRows } = {}) => {
  const safeStudents = Array.isArray(students) ? students : [];
  const safeSessions = Array.isArray(sessionIds) ? sessionIds : [];
  const safeAttendanceRows = Array.isArray(attendanceRows) ? attendanceRows : [];
  const totalPertemuan = safeSessions.length;

  const attendanceMap = new Map();

  safeAttendanceRows.forEach((row) => {
    const key = `${row.session_id}:${row.siswa_id}`;
    attendanceMap.set(key, normalizeStatus(row.status));
  });

  return safeStudents.map((student) => {
    const recap = {
      siswa_id: student.id,
      nama_siswa: student.nama_siswa || '-',
      nis: student.nis || '-',
      total_pertemuan: totalPertemuan,
      hadir: 0,
      sakit: 0,
      izin: 0,
      alpha: 0,
      belum_diisi: 0,
      persentase_kehadiran: 0,
    };

    safeSessions.forEach((sessionId) => {
      const status = attendanceMap.get(`${sessionId}:${student.id}`);

      if (status === 'H') recap.hadir += 1;
      else if (status === 'S') recap.sakit += 1;
      else if (status === 'I') recap.izin += 1;
      else if (status === 'A') recap.alpha += 1;
      else recap.belum_diisi += 1;
    });

    recap.persentase_kehadiran =
      totalPertemuan > 0 ? Math.round((recap.hadir / totalPertemuan) * 1000) / 10 : 0;

    return recap;
  });
};

export const summarizeRecapRows = (rows) => {
  const totalBelumDiisi = (rows || []).reduce(
    (sum, row) => sum + Number(row?.belum_diisi || 0),
    0,
  );

  return {
    totalBelumDiisi,
    isFinal: totalBelumDiisi === 0,
    statusLabel: totalBelumDiisi === 0 ? 'Final' : 'Belum Final',
  };
};

export const buildRecapExcelTableRows = (rows) => {
  const safeRows = Array.isArray(rows) ? rows : [];

  return safeRows.map((row) => ({
    Nama: row.nama_siswa || '-',
    NIS: row.nis || '-',
    'Total Pertemuan': Number(row.total_pertemuan || 0),
    H: Number(row.hadir || 0),
    S: Number(row.sakit || 0),
    I: Number(row.izin || 0),
    A: Number(row.alpha || 0),
    'Belum Diisi': Number(row.belum_diisi || 0),
    '% Kehadiran': Number(row.persentase_kehadiran || 0),
  }));
};

export const buildRecapExcelDataRows = (tableRows) =>
  buildRecapExcelTableRows(tableRows).map((row, index) => ({
    No: index + 1,
    Nama: row.Nama,
    NIS: row.NIS,
    'Total Pertemuan': row['Total Pertemuan'],
    H: row.H,
    S: row.S,
    I: row.I,
    A: row.A,
    '% Kehadiran': row['% Kehadiran'],
    Keterangan: Number(row['Belum Diisi'] || 0) > 0 ? 'Ada data yang kosong' : '-',
  }));

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
