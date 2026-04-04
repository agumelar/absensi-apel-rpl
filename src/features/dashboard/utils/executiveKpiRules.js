const toPercent = (numerator, denominator) => {
  if (!Number.isFinite(denominator) || denominator <= 0) return 0;
  if (!Number.isFinite(numerator) || numerator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
};

export const computeTeacherRates = ({ totalScheduled = 0, totalHadir = 0, totalTidakMasuk = 0, totalLate = 0 }) => ({
  presenceRate: toPercent(totalHadir, totalScheduled),
  tidakMasukRate: toPercent(totalTidakMasuk, totalScheduled),
  lateRate: toPercent(totalLate, totalHadir),
});

export const computeSlaBreach = ({ startMinutes = 0, nowMinutes = 0, hasCheckIn = false }) => ({
  isBreach: !hasCheckIn && Number(nowMinutes) > Number(startMinutes) + 15,
});

export const buildImpactedClassBuckets = (rows = []) => {
  const grouped = new Map();

  rows.forEach((row) => {
    const tanggal = String(row?.tanggal || '').slice(0, 10);
    if (!tanggal) return;

    const set = grouped.get(tanggal) || new Set();
    if (row?.breached && row?.kelas_id !== undefined && row?.kelas_id !== null) {
      set.add(String(row.kelas_id));
    }
    grouped.set(tanggal, set);
  });

  return [...grouped.entries()]
    .map(([tanggal, kelasSet]) => ({
      tanggal,
      impactedClasses: kelasSet.size,
    }))
    .sort((a, b) => String(a.tanggal).localeCompare(String(b.tanggal)));
};

export const buildTrendBuckets = (rows = [], dimension = 'guru') => {
  const grouped = new Map();

  rows.forEach((row) => {
    const tanggal = String(row?.tanggal || '').slice(0, 10);
    if (!tanggal) return;

    const dimensionValue = String(row?.[dimension] || '-');
    const key = `${tanggal}|${dimensionValue}`;
    const current = grouped.get(key) || {
      tanggal,
      dimension: dimensionValue,
      total: 0,
      hadir: 0,
      tidakMasuk: 0,
      late: 0,
    };

    current.total += 1;
    if (row?.statusNorm === 'hadir') current.hadir += 1;
    if (row?.statusNorm === 'tidak masuk') current.tidakMasuk += 1;
    if (row?.isLate) current.late += 1;
    grouped.set(key, current);
  });

  return [...grouped.values()].sort((a, b) => {
    const dateCompare = String(a.tanggal).localeCompare(String(b.tanggal));
    if (dateCompare !== 0) return dateCompare;
    return String(a.dimension).localeCompare(String(b.dimension));
  });
};
