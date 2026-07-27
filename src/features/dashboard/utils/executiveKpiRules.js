const toPercent = (numerator, denominator) => {
  if (!Number.isFinite(denominator) || denominator <= 0) return 0;
  if (!Number.isFinite(numerator) || numerator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
};

const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

const toDateOnly = (value) => String(value || '').trim().slice(0, 10);

export const MAPEL_PERFORMANCE_START_DATE = '2026-07-20';

export const resolvePerformancePeriodStart = (
  fromDate,
  minimumDate = MAPEL_PERFORMANCE_START_DATE,
) => {
  const requestedStart = toDateOnly(fromDate);
  const allowedStart = toDateOnly(minimumDate);
  if (!requestedStart) return allowedStart;
  if (!allowedStart) return requestedStart;
  return requestedStart < allowedStart ? allowedStart : requestedStart;
};

const toMinutes = (value) => {
  const [hoursRaw, minutesRaw] = String(value || '').split(':');
  const hours = Number.parseInt(hoursRaw, 10);
  const minutes = Number.parseInt(minutesRaw, 10);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  return hours * 60 + minutes;
};

const getDayNameForWibDate = (dateValue) => {
  const parsed = new Date(`${toDateOnly(dateValue)}T12:00:00+07:00`);
  if (Number.isNaN(parsed.getTime())) return '';
  return DAY_NAMES[parsed.getUTCDay()] || '';
};

const enumerateDates = (fromDate, toDate) => {
  const start = new Date(`${toDateOnly(fromDate)}T12:00:00+07:00`);
  const end = new Date(`${toDateOnly(toDate)}T12:00:00+07:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];

  const rows = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    rows.push(cursor.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return rows;
};

const classifyExpectedOccurrence = ({ schedule, session, tanggal, todayDate, nowMinutes }) => {
  const startMinutes = toMinutes(schedule?.jam_mulai);
  const endMinutes = toMinutes(schedule?.jam_selesai);
  const isPastDate = tanggal < todayDate;
  const isToday = tanggal === todayDate;
  const hasStarted = isPastDate || (isToday && startMinutes !== null && nowMinutes >= startMinutes);
  const hasEnded = isPastDate || (isToday && endMinutes !== null && nowMinutes > endMinutes);
  const hasCheckIn = Boolean(session?.waktu_check_in);
  const normalizedStatus = String(session?.status || '').trim().toLowerCase();
  const isConfirmedAbsent = normalizedStatus === 'tidak masuk' || normalizedStatus === 'absent';

  if (!hasStarted) return null;

  if (isConfirmedAbsent) {
    return {
      statusNorm: 'tidak masuk',
      statusLabel: 'Tidak Masuk Terkonfirmasi',
      attentionType: 'confirmed_absence',
      isLate: false,
      breached: true,
    };
  }

  if (!hasCheckIn) {
    const isLupaAbsen = hasEnded;
    const breached =
      isPastDate ||
      (isToday && startMinutes !== null && Number(nowMinutes) > startMinutes + 15);
    return {
      statusNorm: isLupaAbsen ? 'tidak masuk' : 'pending',
      statusLabel: isLupaAbsen ? 'Lupa Absen / Tidak Absen' : breached ? 'Belum Check-in (>15 menit)' : 'Menunggu Check-in',
      attentionType: isLupaAbsen ? 'lupa_absen' : breached ? 'sla_breach' : 'pending',
      isLate: false,
      breached,
    };
  }

  const checkInDate = new Date(session.waktu_check_in);
  let checkInMinutes = null;
  if (!Number.isNaN(checkInDate.getTime())) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(checkInDate);
    const partMap = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    checkInMinutes = Number.parseInt(partMap.hour || '0', 10) * 60 + Number.parseInt(partMap.minute || '0', 10);
  }
  const isLate = startMinutes !== null && checkInMinutes !== null && checkInMinutes > startMinutes + 15;

  return {
    statusNorm: 'hadir',
    statusLabel: isLate ? `Terlambat ${Math.max(1, checkInMinutes - startMinutes)} menit` : 'Tepat Waktu',
    attentionType: isLate ? 'late' : session?.waktu_check_out || !hasEnded ? 'complete' : 'missing_checkout',
    isLate,
    breached: false,
  };
};

export const buildExpectedScheduleOccurrences = ({
  schedules = [],
  sessions = [],
  fromDate,
  toDate,
  holidaySet = new Set(),
  todayDate = toDate,
  nowMinutes = 24 * 60,
} = {}) => {
  const dates = enumerateDates(fromDate, toDate);
  const sessionMap = new Map();

  (sessions || []).forEach((session) => {
    const key = `${String(session?.schedule_id || '')}|${toDateOnly(session?.tanggal)}`;
    if (key !== '|') sessionMap.set(key, session);
  });

  const occurrences = [];
  (schedules || []).forEach((schedule) => {
    dates.forEach((tanggal) => {
      if (holidaySet.has(tanggal)) return;
      const dayName = getDayNameForWibDate(tanggal);
      if (['Sabtu', 'Minggu'].includes(dayName)) return;
      if (dayName.toLowerCase() !== String(schedule?.hari || '').trim().toLowerCase()) return;

      const key = `${String(schedule?.id || '')}|${tanggal}`;
      const session = sessionMap.get(key) || null;
      const classification = classifyExpectedOccurrence({
        schedule,
        session,
        tanggal,
        todayDate: toDateOnly(todayDate),
        nowMinutes: Number(nowMinutes),
      });
      if (!classification) return;

      sessionMap.delete(key);
      occurrences.push({
        occurrence_id: session?.id || `expected:${schedule.id}:${tanggal}`,
        is_virtual: !session,
        is_expected_schedule: true,
        session,
        schedule,
        tanggal,
        ...classification,
      });
    });
  });

  // Sesi aktual tetap dipertahankan bila jadwal pernah berubah setelah sesi berlangsung.
  (sessions || []).forEach((session) => {
    const key = `${String(session?.schedule_id || '')}|${toDateOnly(session?.tanggal)}`;
    if (!sessionMap.has(key)) return;
    const schedule = (schedules || []).find((item) => String(item?.id) === String(session?.schedule_id));
    const sessionDate = toDateOnly(session?.tanggal);
    if (!schedule || holidaySet.has(sessionDate) || ['Sabtu', 'Minggu'].includes(getDayNameForWibDate(sessionDate))) return;
    const classification = classifyExpectedOccurrence({
      schedule,
      session,
      tanggal: sessionDate,
      todayDate: toDateOnly(todayDate),
      nowMinutes: Number(nowMinutes),
    });
    if (!classification) return;
    occurrences.push({
      occurrence_id: session.id,
      is_virtual: false,
      is_expected_schedule: false,
      session,
      schedule,
      tanggal: sessionDate,
      ...classification,
    });
  });

  return occurrences.sort((a, b) => {
    const dateCompare = String(b.tanggal).localeCompare(String(a.tanggal));
    if (dateCompare !== 0) return dateCompare;
    return String(a.schedule?.jam_mulai || '').localeCompare(String(b.schedule?.jam_mulai || ''));
  });
};

export const computeTeacherRates = ({ totalScheduled = 0, totalHadir = 0, totalTidakMasuk = 0, totalLate = 0 }) => ({
  presenceRate: toPercent(totalHadir, totalScheduled),
  tidakMasukRate: toPercent(totalTidakMasuk, totalScheduled),
  lateRate: toPercent(totalLate, totalHadir),
});

export const computeTeacherAttentionScore = ({
  lupaAbsen = 0,
  confirmedAbsence = 0,
  late = 0,
  missingCheckOut = 0,
  slaBreach = 0,
} = {}) =>
  Number(lupaAbsen || 0) * 4 +
  Number(confirmedAbsence || 0) * 2 +
  Number(late || 0) * 2 +
  Number(missingCheckOut || 0) +
  Number(slaBreach || 0) * 3;

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
