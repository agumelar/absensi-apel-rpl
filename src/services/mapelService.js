import { supabase } from './supabase/client';
import {
  assertGuruOwnershipOrThrow,
  assertMapelAccessOrThrow,
  getSessionOrThrow,
} from './auth/sessionService';
import { isExecutiveRole, isMapelAuditRole, normalizeRole } from '../shared/constants/roles';
import { getTodayDateWIB } from './shared/dateService';
import {
  buildPeriodRange,
  buildStudentRecapRows,
  summarizeRecapRows,
} from '../features/mapel/utils/attendanceRecapRules';
import {
  buildScoreRecapRows,
  summarizeScoreRecapRows,
} from '../features/mapel/utils/scoreRecapRules';
import {
  buildSessionClassMap,
  buildStudentClassMap,
  findFirstAttendanceClassMismatch,
} from '../features/mapel/utils/attendanceIntegrityRules';
import {
  buildImpactedClassBuckets,
  buildTrendBuckets,
  computeSlaBreach,
  computeTeacherRates,
} from '../features/dashboard/utils/executiveKpiRules';
import {
  buildSchoolHolidaySet,
  filterActiveSchoolSessionRows,
  isActiveSchoolDate,
} from '../features/mapel/utils/schoolDayRules';

const SESSION_STATUS = {
  HADIR: 'Hadir',
  TIDAK_MASUK: 'Tidak Masuk',
  PENDING: 'Pending',
};

const MAPEL_AUDIT_ACTION = {
  AGENDA_SUBMIT: 'agenda_submit',
  SESSION_CHECK_IN: 'session_check_in',
  SESSION_CHECK_OUT: 'session_check_out',
  ATTENDANCE_MANUAL_SAVE: 'attendance_manual_save',
  TASK_DELIVERED_BY_PICKET: 'task_delivered_by_picket',
};

const ATTENDANCE_STATUS_MAP = {
  H: 'Hadir',
  HADIR: 'Hadir',
  S: 'Sakit',
  SAKIT: 'Sakit',
  I: 'Izin',
  IZIN: 'Izin',
  A: 'Alpha',
  ALPHA: 'Alpha',
};

const normalizeAttendanceStatus = (status) => {
  const normalized = ATTENDANCE_STATUS_MAP[String(status ?? '').trim().toUpperCase()];
  if (!normalized) {
    throw new Error(`Status absensi mapel tidak valid: ${status}`);
  }

  return normalized;
};

const assertRequired = (name, value) => {
  if (value === undefined || value === null || value === '') {
    throw new Error(`${name} wajib diisi`);
  }
};

const normalizeTimeToMinutes = (timeValue, fieldName) => {
  const [hoursRaw, minutesRaw] = String(timeValue ?? '').split(':');
  const hours = Number.parseInt(hoursRaw, 10);
  const minutes = Number.parseInt(minutesRaw, 10);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    throw new Error(`${fieldName} tidak valid`);
  }

  return hours * 60 + minutes;
};

const isTimeRangeOverlap = (startA, endA, startB, endB) => startA < endB && startB < endA;

const formatTimeLabel = (timeValue) => String(timeValue ?? '').slice(0, 5);

const SLA_GURU_KOSONG_MINUTES = 15;
const LATE_CHECKIN_TOLERANCE_MINUTES = 15;

const DAY_NAME_MAP = {
  minggu: 'Minggu',
  senin: 'Senin',
  selasa: 'Selasa',
  rabu: 'Rabu',
  kamis: 'Kamis',
  jumat: 'Jumat',
  sabtu: 'Sabtu',
};

const toWibDateTime = (dateValue, timeValue = '00:00:00') => {
  const safeDate = String(dateValue || '').slice(0, 10);
  const safeTime = String(timeValue || '00:00:00').slice(0, 8);
  return new Date(`${safeDate}T${safeTime}+07:00`);
};

const getWibMinutesNow = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const map = {};
  parts.forEach((part) => {
    map[part.type] = part.value;
  });
  const hours = Number.parseInt(map.hour || '0', 10);
  const minutes = Number.parseInt(map.minute || '0', 10);
  return hours * 60 + minutes;
};

const resolveMapelGeoPolicy = async () => {
  const { data, error } = await supabase.from('pembiasaan_settings').select('school_lat, school_lng, radius_meter').eq('id', 1).maybeSingle();
  if (error) throw error;
  if (!data?.school_lat || !data?.school_lng || !data?.radius_meter) {
    return { enabled: false, schoolLat: null, schoolLng: null, radiusMeter: null };
  }
  return {
    enabled: true,
    schoolLat: Number(data.school_lat),
    schoolLng: Number(data.school_lng),
    radiusMeter: Number(data.radius_meter),
  };
};

const calculateDistanceMeters = (lat1, lng1, lat2, lng2) => {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
};

const assertWithinMapelGeoPolicy = async (geo = null) => {
  const policy = await resolveMapelGeoPolicy();
  if (!policy.enabled) return { enabled: false, distanceMeter: null, radiusMeter: null };

  if (!geo || !Number.isFinite(Number(geo.lat)) || !Number.isFinite(Number(geo.lng))) {
    throw new Error('Lokasi GPS wajib aktif untuk check-in/check-out KBM.');
  }

  const distance = calculateDistanceMeters(policy.schoolLat, policy.schoolLng, Number(geo.lat), Number(geo.lng));
  if (distance > policy.radiusMeter) {
    throw new Error(`Lokasi di luar radius sekolah (${policy.radiusMeter} meter).`);
  }

  return { enabled: true, distanceMeter: distance, radiusMeter: policy.radiusMeter };
};

const getDayNameWIB = (dateValue) => {
  const rawDay = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
  }).format(toWibDateTime(dateValue));
  return DAY_NAME_MAP[String(rawDay || '').trim().toLowerCase()] ?? rawDay;
};

const normalizeSessionStatus = (status) => String(status || '').trim().toLowerCase();

const fetchSchoolHolidaySetInRange = async ({ fromDate, toDate } = {}) => {
  if (!fromDate || !toDate) return new Set();
  const { data, error } = await supabase
    .from('school_calendar')
    .select('tanggal, is_libur')
    .gte('tanggal', fromDate)
    .lte('tanggal', toDate);
  if (error) throw error;
  return buildSchoolHolidaySet(data || []);
};

const assertPiketAccessOrThrow = () => {
  const session = getSessionOrThrow();
  const role = normalizeRole(session.role);
  if (role !== 'piket' && role !== 'admin') {
    throw new Error('Akses modul piket mapel ditolak untuk role ini.');
  }
  return session;
};

const assertExecutiveAccessOrThrow = () => {
  const session = getSessionOrThrow();
  const role = normalizeRole(session.role);
  if (!isExecutiveRole(role) && role !== 'admin') {
    throw new Error('Akses executive mapel ditolak untuk role ini.');
  }
  return session;
};

const resolveExecutiveScopeOrThrow = async () => {
  const session = assertExecutiveAccessOrThrow();
  const role = normalizeRole(session.role);

  if (role === 'admin' || role === 'kepsek' || role === 'kurikulum' || role === 'kesiswaan') {
    return {
      role,
      jurusanId: null,
      isJurusanScoped: false,
      actorId: session.walikelas_id || session.id || null,
    };
  }

  if (role !== 'kaprog') {
    throw new Error('Role ini tidak memiliki akses executive KPI mapel.');
  }

  let jurusanId = Number.parseInt(session.jurusan_id, 10);
  const actorId = session.walikelas_id || session.id;

  if ((!Number.isInteger(jurusanId) || jurusanId <= 0) && actorId) {
    const { data, error } = await supabase.from('walikelas').select('jurusan_id').eq('id', actorId).maybeSingle();
    if (error) throw error;
    jurusanId = Number.parseInt(data?.jurusan_id, 10);
  }

  if (!Number.isInteger(jurusanId) || jurusanId <= 0) {
    throw new Error('Scope jurusan kaprog tidak valid. Hubungi admin untuk sinkronisasi profil jurusan.');
  }

  return {
    role,
    jurusanId,
    isJurusanScoped: true,
    actorId: actorId || null,
  };
};

const assertSessionOwnershipOrThrow = async (sessionId) => {
  const session = assertMapelAccessOrThrow();
  if (session.role === 'admin') return;

  const { data, error } = await supabase
    .from('session')
    .select('schedule:schedule_id(guru_id)')
    .eq('id', sessionId)
    .single();
  if (error) throw error;

  const ownerId = String(data?.schedule?.guru_id ?? '');
  if (ownerId && ownerId !== String(session.walikelas_id)) {
    throw new Error('Akses sesi guru lain ditolak.');
  }
};

const recordMapelAuditLog = async ({ sessionId, actionType, metadata, actorName }) => {
  assertRequired('sessionId', sessionId);
  assertRequired('actionType', actionType);
  const session = getSessionOrThrow();
  const role = String(session.role || '').toLowerCase();
  const actorId = String(session.walikelas_id || '');
  if (!actorId) {
    throw new Error('Actor audit mapel tidak valid.');
  }

  if (!Object.values(MAPEL_AUDIT_ACTION).includes(actionType)) {
    throw new Error(`Action audit mapel tidak valid: ${actionType}`);
  }

  const payload = {
    session_id: String(sessionId),
    actor_id: actorId,
    actor_name: String(actorName ?? session.nama_lengkap ?? session.username ?? '').trim() || null,
    actor_role: role,
    action_type: actionType,
    metadata: metadata ?? {},
  };

  const { error } = await supabase.from('mapel_audit_log').insert([payload]);
  if (error) throw error;
};

const isAuditActionConstraintMismatch = (error) => {
  if (String(error?.code || '') !== '23514') return false;

  const constraint = String(error?.constraint || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  const details = String(error?.details || '').toLowerCase();

  return (
    constraint.includes('mapel_audit_log_action_type_check') ||
    message.includes('mapel_audit_log_action_type_check') ||
    details.includes('mapel_audit_log_action_type_check')
  );
};

export const validateScheduleConflict = async ({ guruId, hari, jamMulai, jamSelesai, excludeScheduleId }) => {
  assertRequired('guruId', guruId);
  assertRequired('hari', hari);
  assertRequired('jamMulai', jamMulai);
  assertRequired('jamSelesai', jamSelesai);

  const startMinutes = normalizeTimeToMinutes(jamMulai, 'jamMulai');
  const endMinutes = normalizeTimeToMinutes(jamSelesai, 'jamSelesai');
  if (endMinutes <= startMinutes) {
    throw new Error('jamSelesai harus lebih besar dari jamMulai');
  }

  let query = supabase
    .from('schedule')
    .select('id, hari, jam_mulai, jam_selesai, mapel_id, kelas_id')
    .eq('guru_id', guruId)
    .eq('hari', hari);

  if (excludeScheduleId) {
    query = query.neq('id', excludeScheduleId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const conflict = (data || []).find((item) => {
    const itemStart = normalizeTimeToMinutes(item.jam_mulai, 'jam_mulai');
    const itemEnd = normalizeTimeToMinutes(item.jam_selesai, 'jam_selesai');
    return isTimeRangeOverlap(startMinutes, endMinutes, itemStart, itemEnd);
  });

  return {
    isConflict: Boolean(conflict),
    conflict,
  };
};

export const fetchMasterMapel = async () => {
  assertMapelAccessOrThrow();
  const { data, error } = await supabase
    .from('master_mapel')
    .select('id, nama_mapel, kode_mapel')
    .order('nama_mapel', { ascending: true });

  if (error) throw error;
  return data || [];
};

export const fetchMapelRecapFilterOptions = async ({ guruId } = {}) => {
  assertRequired('guruId', guruId);
  assertGuruOwnershipOrThrow(guruId);

  const { data, error } = await supabase
    .from('schedule')
    .select('kelas_id, mapel_id, master_kelas(nama_kelas), master_mapel(nama_mapel, kode_mapel)')
    .eq('guru_id', guruId);

  if (error) throw error;

  const kelasMap = new Map();
  const mapelMap = new Map();

  (data || []).forEach((row) => {
    if (row.kelas_id) {
      kelasMap.set(String(row.kelas_id), {
        id: row.kelas_id,
        nama_kelas: row.master_kelas?.nama_kelas || '-',
      });
    }

    if (row.mapel_id) {
      mapelMap.set(String(row.mapel_id), {
        id: row.mapel_id,
        nama_mapel: row.master_mapel?.nama_mapel || '-',
        kode_mapel: row.master_mapel?.kode_mapel || '-',
      });
    }
  });

  return {
    kelasOptions: [...kelasMap.values()].sort((a, b) =>
      String(a.nama_kelas || '').localeCompare(String(b.nama_kelas || '')),
    ),
    mapelOptions: [...mapelMap.values()].sort((a, b) =>
      String(a.nama_mapel || '').localeCompare(String(b.nama_mapel || '')),
    ),
  };
};

export const fetchMapelAttendanceRecap = async ({
  guruId,
  kelasId,
  mapelId,
  periodMode,
  anchorDate,
  fromDate,
  toDate,
} = {}) => {
  assertRequired('guruId', guruId);
  assertRequired('kelasId', kelasId);
  assertRequired('mapelId', mapelId);
  assertGuruOwnershipOrThrow(guruId);

  const { data: authorizedSchedule, error: authorizedScheduleError } = await supabase
    .from('schedule')
    .select('id')
    .eq('guru_id', String(guruId))
    .eq('kelas_id', Number(kelasId))
    .eq('mapel_id', Number(mapelId))
    .limit(1)
    .maybeSingle();

  if (authorizedScheduleError) throw authorizedScheduleError;
  if (!authorizedSchedule) {
    throw new Error('Guru tidak memiliki akses rekap untuk kombinasi kelas/mapel ini.');
  }

  const period = buildPeriodRange({
    mode: periodMode,
    anchorDate,
    fromDate,
    toDate,
  });

  const { data: sessionRows, error: sessionError } = await supabase
    .from('session')
    .select('id, tanggal, created_at, schedule:schedule_id!inner(guru_id, kelas_id, mapel_id)')
    .eq('schedule.guru_id', String(guruId))
    .eq('schedule.kelas_id', Number(kelasId))
    .eq('schedule.mapel_id', Number(mapelId))
    .gte('tanggal', period.fromDate)
    .lte('tanggal', period.toDate)
    .order('tanggal', { ascending: true })
    .order('created_at', { ascending: true });

  if (sessionError) throw sessionError;

  const holidaySet = await fetchSchoolHolidaySetInRange({ fromDate: period.fromDate, toDate: period.toDate });
  const activeSessionRows = filterActiveSchoolSessionRows(sessionRows || [], holidaySet);

  const sessionIds = activeSessionRows.map((item) => item.id);
  const [{ data: students, error: studentError }, { data: attendanceRows, error: attendanceError }] =
    await Promise.all([
      supabase
        .from('siswa')
        .select('id, nama_siswa, nis')
        .eq('kelas_id', Number(kelasId))
        .eq('status_siswa', 'Aktif')
        .order('nama_siswa', { ascending: true }),
      sessionIds.length > 0
        ? supabase.from('student_attendance_mapel').select('session_id, siswa_id, status').in('session_id', sessionIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (studentError) throw studentError;
  if (attendanceError) throw attendanceError;

  const rows = buildStudentRecapRows({
    students: students || [],
    sessionIds,
    attendanceRows: attendanceRows || [],
  });
  const summary = summarizeRecapRows(rows);

  const validAttendanceStatuses = new Set([
    'H',
    'HADIR',
    'Hadir',
    'S',
    'SAKIT',
    'Sakit',
    'I',
    'IZIN',
    'Izin',
    'A',
    'ALPHA',
    'Alpha',
  ]);
  const filledKeySet = new Set(
    (attendanceRows || [])
      .filter((row) => validAttendanceStatuses.has(String(row?.status || '').trim()))
      .map((row) => `${row.session_id}:${row.siswa_id}`),
  );
  const sessionById = new Map(activeSessionRows.map((sessionRow) => [String(sessionRow.id), sessionRow]));
  const missingEntries = [];

  (students || []).forEach((studentRow) => {
    sessionIds.forEach((sessionId) => {
      const key = `${sessionId}:${studentRow.id}`;
      if (filledKeySet.has(key)) return;

      const sessionData = sessionById.get(String(sessionId));
      missingEntries.push({
        session_id: sessionId,
        session_tanggal: sessionData?.tanggal || null,
        siswa_id: studentRow.id,
        nama_siswa: studentRow.nama_siswa || '-',
        nis: studentRow.nis || '-',
      });
    });
  });

  const postingDate = activeSessionRows.reduce((latest, row) => {
    const createdAt = String(row?.created_at || '').trim();
    if (!createdAt) return latest;
    if (!latest || createdAt > latest) return createdAt;
    return latest;
  }, null);

  return {
    period,
    postingDate,
    totalPertemuan: sessionIds.length,
    rows,
    summary,
    missingEntries,
  };
};

export const fetchMapelScoreRecap = async ({
  guruId,
  kelasId,
  mapelId,
  periodMode,
  anchorDate,
  fromDate,
  toDate,
} = {}) => {
  assertRequired('guruId', guruId);
  assertRequired('kelasId', kelasId);
  assertRequired('mapelId', mapelId);
  assertGuruOwnershipOrThrow(guruId);

  const { data: authorizedSchedule, error: authorizedScheduleError } = await supabase
    .from('schedule')
    .select('id')
    .eq('guru_id', String(guruId))
    .eq('kelas_id', Number(kelasId))
    .eq('mapel_id', Number(mapelId))
    .limit(1)
    .maybeSingle();

  if (authorizedScheduleError) throw authorizedScheduleError;
  if (!authorizedSchedule) {
    throw new Error('Guru tidak memiliki akses rekap nilai untuk kombinasi kelas/mapel ini.');
  }

  const period = buildPeriodRange({
    mode: periodMode,
    anchorDate,
    fromDate,
    toDate,
  });

  const { data: sessionRows, error: sessionError } = await supabase
    .from('session')
    .select('id, tanggal, created_at, schedule:schedule_id!inner(guru_id, kelas_id, mapel_id)')
    .eq('schedule.guru_id', String(guruId))
    .eq('schedule.kelas_id', Number(kelasId))
    .eq('schedule.mapel_id', Number(mapelId))
    .gte('tanggal', period.fromDate)
    .lte('tanggal', period.toDate)
    .order('tanggal', { ascending: true })
    .order('created_at', { ascending: true });

  if (sessionError) throw sessionError;

  const holidaySet = await fetchSchoolHolidaySetInRange({ fromDate: period.fromDate, toDate: period.toDate });
  const activeSessionRows = filterActiveSchoolSessionRows(sessionRows || [], holidaySet);

  const sessionIds = activeSessionRows.map((item) => item.id);
  const [{ data: students, error: studentError }, { data: scoreRows, error: scoreError }] = await Promise.all([
    supabase
      .from('siswa')
      .select('id, nama_siswa, nis')
      .eq('kelas_id', Number(kelasId))
      .eq('status_siswa', 'Aktif')
      .order('nama_siswa', { ascending: true }),
    sessionIds.length > 0
      ? supabase.from('daily_score').select('session_id, siswa_id, nilai').in('session_id', sessionIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (studentError) throw studentError;
  if (scoreError) throw scoreError;

  const rows = buildScoreRecapRows({
    students: students || [],
    sessionIds,
    scoreRows: scoreRows || [],
  });
  const summary = summarizeScoreRecapRows(rows);

  const postingDate = activeSessionRows.reduce((latest, row) => {
    const createdAt = String(row?.created_at || '').trim();
    if (!createdAt) return latest;
    if (!latest || createdAt > latest) return createdAt;
    return latest;
  }, null);

  return {
    period,
    postingDate,
    totalPertemuan: sessionIds.length,
    rows,
    summary,
  };
};

export const fetchSchedulesByGuru = async (guruId) => {
  assertRequired('guruId', guruId);
  assertGuruOwnershipOrThrow(guruId);

  const { data, error } = await supabase
    .from('schedule')
    .select('*, master_kelas(nama_kelas), master_mapel(nama_mapel, kode_mapel)')
    .eq('guru_id', guruId)
    .order('hari', { ascending: true })
    .order('jam_mulai', { ascending: true });

  if (error) throw error;
  return data || [];
};

export const fetchSchedulesByGuruToday = async (guruId, tanggal = getTodayDateWIB()) => {
  assertRequired('guruId', guruId);
  assertGuruOwnershipOrThrow(guruId);
  assertRequired('tanggal', tanggal);

  const targetDay = getDayNameWIB(tanggal);
  const { data, error } = await supabase
    .from('schedule')
    .select('*, master_kelas(nama_kelas), master_mapel(nama_mapel, kode_mapel)')
    .eq('guru_id', guruId)
    .eq('hari', targetDay)
    .order('jam_mulai', { ascending: true });

  if (error) throw error;
  return data || [];
};

export const createSchedule = async ({ guruId, kelasId, mapelId, hari, jamMulai, jamSelesai }) => {
  assertRequired('guruId', guruId);
  assertGuruOwnershipOrThrow(guruId);
  assertRequired('kelasId', kelasId);
  assertRequired('mapelId', mapelId);
  assertRequired('hari', hari);
  assertRequired('jamMulai', jamMulai);
  assertRequired('jamSelesai', jamSelesai);

  const conflictCheck = await validateScheduleConflict({ guruId, hari, jamMulai, jamSelesai });
  if (conflictCheck.isConflict) {
    throw new Error(
      `Jadwal bentrok dengan slot ${formatTimeLabel(conflictCheck.conflict.jam_mulai)}-${formatTimeLabel(conflictCheck.conflict.jam_selesai)}`,
    );
  }

  const payload = {
    guru_id: guruId,
    kelas_id: kelasId,
    mapel_id: mapelId,
    hari,
    jam_mulai: jamMulai,
    jam_selesai: jamSelesai,
  };

  const { data, error } = await supabase.from('schedule').insert([payload]).select('*').single();
  if (error) throw error;
  return data;
};

export const updateSchedule = async (scheduleId, payload) => {
  assertRequired('scheduleId', scheduleId);
  assertMapelAccessOrThrow();

  const { data: existingSchedule, error: existingError } = await supabase
    .from('schedule')
    .select('*')
    .eq('id', scheduleId)
    .single();
  if (existingError) throw existingError;
  assertGuruOwnershipOrThrow(existingSchedule.guru_id);

  const guruId = payload.guruId ?? existingSchedule.guru_id;
  const hari = payload.hari ?? existingSchedule.hari;
  const jamMulai = payload.jamMulai ?? existingSchedule.jam_mulai;
  const jamSelesai = payload.jamSelesai ?? existingSchedule.jam_selesai;

  const conflictCheck = await validateScheduleConflict({
    guruId,
    hari,
    jamMulai,
    jamSelesai,
    excludeScheduleId: scheduleId,
  });
  if (conflictCheck.isConflict) {
    throw new Error(
      `Jadwal bentrok dengan slot ${formatTimeLabel(conflictCheck.conflict.jam_mulai)}-${formatTimeLabel(conflictCheck.conflict.jam_selesai)}`,
    );
  }

  const updatePayload = {};
  if (payload.guruId !== undefined) updatePayload.guru_id = payload.guruId;
  if (payload.kelasId !== undefined) updatePayload.kelas_id = payload.kelasId;
  if (payload.mapelId !== undefined) updatePayload.mapel_id = payload.mapelId;
  if (payload.hari !== undefined) updatePayload.hari = payload.hari;
  if (payload.jamMulai !== undefined) updatePayload.jam_mulai = payload.jamMulai;
  if (payload.jamSelesai !== undefined) updatePayload.jam_selesai = payload.jamSelesai;

  const { data, error } = await supabase
    .from('schedule')
    .update(updatePayload)
    .eq('id', scheduleId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
};

export const deleteSchedule = async (scheduleId) => {
  assertRequired('scheduleId', scheduleId);
  const { data: existingSchedule, error: existingError } = await supabase
    .from('schedule')
    .select('guru_id')
    .eq('id', scheduleId)
    .single();
  if (existingError) throw existingError;
  assertGuruOwnershipOrThrow(existingSchedule.guru_id);
  const { error } = await supabase.from('schedule').delete().eq('id', scheduleId);
  if (error) throw error;
};

export const fetchSessionsByTanggal = async (tanggal) => {
  assertRequired('tanggal', tanggal);
  const session = assertMapelAccessOrThrow();

  const query = supabase
    .from('session')
    .select('*, schedule(*, master_mapel(nama_mapel), master_kelas(nama_kelas))')
    .eq('tanggal', tanggal)
    .order('created_at', { ascending: false });

  const { data, error } = await query;
  if (error) throw error;
  if (session.role === 'admin') return data || [];
  return (data || []).filter((item) => String(item?.schedule?.guru_id ?? '') === String(session.walikelas_id));
};

export const fetchSessionsByDateRange = async ({ fromDate, toDate, kelasId } = {}) => {
  assertRequired('fromDate', fromDate);
  assertRequired('toDate', toDate);
  const session = assertMapelAccessOrThrow();

  let query = supabase
    .from('session')
    .select(
      '*, schedule(*, master_mapel(nama_mapel), master_kelas(nama_kelas)), class_agenda(topik, metode), student_attendance_mapel(status), teacher_absence_task(id, delivered_by_picket, delivered_at)',
    )
    .gte('tanggal', fromDate)
    .lte('tanggal', toDate)
    .order('tanggal', { ascending: false })
    .order('created_at', { ascending: false });

  if (kelasId) {
    query = query.eq('schedule.kelas_id', Number(kelasId));
  }

  const { data, error } = await query;

  if (error) throw error;
  if (session.role === 'admin') return data || [];
  return (data || []).filter((item) => String(item?.schedule?.guru_id ?? '') === String(session.walikelas_id));
};

export const createSession = async ({ scheduleId, tanggal }) => {
  assertRequired('scheduleId', scheduleId);
  assertMapelAccessOrThrow();
  const { data: scheduleData, error: scheduleError } = await supabase
    .from('schedule')
    .select('guru_id, hari')
    .eq('id', scheduleId)
    .single();
  if (scheduleError) throw scheduleError;
  assertGuruOwnershipOrThrow(scheduleData.guru_id);
  const targetDate = tanggal ?? getTodayDateWIB();
  const expectedDay = getDayNameWIB(targetDate);
  const scheduleDay = String(scheduleData?.hari ?? '').trim().toLowerCase();
  if (!scheduleDay || scheduleDay !== String(expectedDay).trim().toLowerCase()) {
    throw new Error('Jadwal ini tidak aktif untuk hari ini. Pilih jadwal sesuai hari berjalan.');
  }

  const payload = {
    schedule_id: scheduleId,
    tanggal: targetDate,
    status: SESSION_STATUS.PENDING,
  };

  const { data, error } = await supabase.from('session').insert([payload]).select('*').single();
  if (error) throw error;
  return data;
};

export const checkInSession = async (sessionId, fotoCheckIn, options = {}) => {
  assertRequired('sessionId', sessionId);
  assertRequired('fotoCheckIn', fotoCheckIn);
  await assertSessionOwnershipOrThrow(sessionId);
  const geoValidation = await assertWithinMapelGeoPolicy(options.geo);

  const { data, error } = await supabase
    .from('session')
    .update({
      status: SESSION_STATUS.HADIR,
      waktu_check_in: new Date().toISOString(),
      foto_check_in: fotoCheckIn,
    })
    .eq('id', sessionId)
    .select('*')
    .single();

  if (error) throw error;
  await recordMapelAuditLog({
    sessionId,
    actionType: MAPEL_AUDIT_ACTION.SESSION_CHECK_IN,
    actorName: options.actorName,
      metadata: {
        foto_check_in: fotoCheckIn,
        status_after: data?.status ?? SESSION_STATUS.HADIR,
        waktu_check_in: data?.waktu_check_in ?? null,
        geo_validation_enabled: geoValidation.enabled,
        geo_distance_meter: geoValidation.distanceMeter,
        geo_radius_meter: geoValidation.radiusMeter,
      },
    });
  return data;
};

export const checkOutSession = async (sessionId, fotoCheckOut, options = {}) => {
  assertRequired('sessionId', sessionId);
  assertRequired('fotoCheckOut', fotoCheckOut);
  await assertSessionOwnershipOrThrow(sessionId);
  const geoValidation = await assertWithinMapelGeoPolicy(options.geo);

  const { data, error } = await supabase
    .from('session')
    .update({
      waktu_check_out: new Date().toISOString(),
      foto_check_out: fotoCheckOut,
    })
    .eq('id', sessionId)
    .select('*')
    .single();

  if (error) throw error;
  await recordMapelAuditLog({
    sessionId,
    actionType: MAPEL_AUDIT_ACTION.SESSION_CHECK_OUT,
    actorName: options.actorName,
    metadata: {
      foto_check_out: fotoCheckOut,
      waktu_check_out: data?.waktu_check_out ?? null,
      geo_validation_enabled: geoValidation.enabled,
      geo_distance_meter: geoValidation.distanceMeter,
      geo_radius_meter: geoValidation.radiusMeter,
    },
  });
  return data;
};

export const markSessionTidakMasuk = async (sessionId) => {
  assertRequired('sessionId', sessionId);
  await assertSessionOwnershipOrThrow(sessionId);

  const { data, error } = await supabase
    .from('session')
    .update({ status: SESSION_STATUS.TIDAK_MASUK })
    .eq('id', sessionId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
};

export const upsertClassAgenda = async ({ sessionId, topik, metode, actorName }) => {
  assertRequired('sessionId', sessionId);
  assertRequired('topik', topik);
  await assertSessionOwnershipOrThrow(sessionId);

  const payload = {
    session_id: sessionId,
    topik,
    metode: metode ?? null,
  };

  const { data, error } = await supabase
    .from('class_agenda')
    .upsert(payload, { onConflict: 'session_id' })
    .select('*')
    .single();

  if (error) throw error;
  await recordMapelAuditLog({
    sessionId,
    actionType: MAPEL_AUDIT_ACTION.AGENDA_SUBMIT,
    actorName,
    metadata: {
      agenda_id: data?.id ?? null,
      topik: String(topik || '').trim(),
      metode: metode ?? null,
    },
  });
  return data;
};

export const fetchClassAgendaBySession = async (sessionId) => {
  assertRequired('sessionId', sessionId);
  await assertSessionOwnershipOrThrow(sessionId);
  const { data, error } = await supabase.from('class_agenda').select('*').eq('session_id', sessionId).maybeSingle();
  if (error) throw error;
  return data;
};

export const hasSubmittedAgenda = async (sessionId) => {
  const agenda = await fetchClassAgendaBySession(sessionId);
  return Boolean(agenda?.topik && String(agenda.topik).trim().length > 0);
};

const enforceAgendaSubmitted = async (sessionId) => {
  const agendaReady = await hasSubmittedAgenda(sessionId);
  if (!agendaReady) {
    throw new Error('Agenda/topik wajib disubmit sebelum melakukan absensi mapel.');
  }
};

export const upsertStudentAttendanceMapel = async ({ sessionId, siswaId, status }) => {
  assertRequired('sessionId', sessionId);
  assertRequired('siswaId', siswaId);
  assertRequired('status', status);
  await assertSessionOwnershipOrThrow(sessionId);
  await enforceAgendaSubmitted(sessionId);

  const [{ data: sessionData, error: sessionError }, { data: siswaData, error: siswaError }] = await Promise.all([
    supabase
      .from('session')
      .select('id, schedule:schedule_id!inner(kelas_id)')
      .eq('id', sessionId)
      .single(),
    supabase.from('siswa').select('id, kelas_id').eq('id', siswaId).single(),
  ]);

  if (sessionError) throw sessionError;
  if (siswaError) throw siswaError;

  const kelasId = Number(sessionData?.schedule?.kelas_id);
  const siswaKelasId = Number(siswaData?.kelas_id);
  if (!kelasId || !siswaKelasId || kelasId !== siswaKelasId) {
    throw new Error('Siswa tidak terdaftar pada kelas sesi ini.');
  }

  const payload = {
    session_id: sessionId,
    siswa_id: siswaId,
    status: normalizeAttendanceStatus(status),
  };

  const { data, error } = await supabase
    .from('student_attendance_mapel')
    .upsert(payload, { onConflict: 'session_id,siswa_id' })
    .select('*')
    .single();

  if (error) throw error;
  return data;
};

export const fillMissingAttendanceForSession = async ({ sessionId, siswaId, status, actorName } = {}) => {
  assertRequired('sessionId', sessionId);
  assertRequired('siswaId', siswaId);
  assertRequired('status', status);
  await assertSessionOwnershipOrThrow(sessionId);
  await enforceAgendaSubmitted(sessionId);

  const normalizedStatusCode = String(status || '').trim().toUpperCase();
  if (!['H', 'S', 'I', 'A'].includes(normalizedStatusCode)) {
    throw new Error('Status absensi mapel tidak valid. Gunakan H/S/I/A.');
  }

  const [{ data: sessionData, error: sessionError }, { data: siswaData, error: siswaError }] = await Promise.all([
    supabase
      .from('session')
      .select('id, schedule:schedule_id!inner(kelas_id)')
      .eq('id', sessionId)
      .single(),
    supabase.from('siswa').select('id, kelas_id').eq('id', siswaId).single(),
  ]);

  if (sessionError) throw sessionError;
  if (siswaError) throw siswaError;

  const kelasId = Number(sessionData?.schedule?.kelas_id);
  const siswaKelasId = Number(siswaData?.kelas_id);
  if (!kelasId || !siswaKelasId || kelasId !== siswaKelasId) {
    throw new Error('Siswa tidak terdaftar pada kelas sesi ini.');
  }

  const payload = {
    session_id: sessionId,
    siswa_id: siswaId,
    status: normalizeAttendanceStatus(normalizedStatusCode),
    diubah_pada: new Date().toISOString(),
    diubah_oleh: String(actorName || '').trim() || null,
  };

  const { data, error } = await supabase
    .from('student_attendance_mapel')
    .insert([payload])
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error('Data absensi siswa ini sudah terisi. Gunakan menu sesi untuk koreksi manual.');
    }
    throw error;
  }

  await recordMapelAuditLog({
    sessionId,
    actionType: MAPEL_AUDIT_ACTION.ATTENDANCE_MANUAL_SAVE,
    actorName,
    metadata: {
      source: 'recap_backfill_missing',
      siswa_id: siswaId,
      status_before: null,
      status_after: normalizeAttendanceStatus(normalizedStatusCode),
      diubah_pada: payload.diubah_pada,
      diubah_oleh: payload.diubah_oleh,
    },
  });

  return data;
};

export const upsertBulkStudentAttendanceMapel = async (entries, options = {}) => {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('entries absensi mapel tidak boleh kosong');
  }
  assertMapelAccessOrThrow();

  const sessionIds = [...new Set(entries.map((entry) => entry.sessionId).filter(Boolean))];
  if (sessionIds.length === 0) {
    throw new Error('sessionId absensi mapel wajib diisi');
  }

  await Promise.all(sessionIds.map((sessionId) => assertSessionOwnershipOrThrow(sessionId)));
  await Promise.all(sessionIds.map((sessionId) => enforceAgendaSubmitted(sessionId)));

  const siswaIds = [...new Set(entries.map((entry) => entry.siswaId).filter(Boolean))];
  const [{ data: sessionRows, error: sessionError }, { data: siswaRows, error: siswaError }] = await Promise.all([
    supabase
      .from('session')
      .select('id, schedule:schedule_id!inner(kelas_id)')
      .in('id', sessionIds),
    siswaIds.length
      ? supabase.from('siswa').select('id, kelas_id').in('id', siswaIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (sessionError) throw sessionError;
  if (siswaError) throw siswaError;

  const mismatch = findFirstAttendanceClassMismatch(
    entries,
    buildSessionClassMap(sessionRows),
    buildStudentClassMap(siswaRows),
  );

  if (mismatch) {
    throw new Error(
      `Data absensi tidak valid: siswa ${mismatch.siswaId || '-'} bukan bagian dari kelas sesi ${mismatch.sessionId || '-'}.`,
    );
  }

  const payload = entries.map((entry) => ({
    session_id: entry.sessionId,
    siswa_id: entry.siswaId,
    status: normalizeAttendanceStatus(entry.status),
  }));

  const { error } = await supabase
    .from('student_attendance_mapel')
    .upsert(payload, { onConflict: 'session_id,siswa_id' });

  if (error) throw error;

  await Promise.all(
    sessionIds.map((sessionId) => {
      const payloadBySession = payload.filter((item) => String(item.session_id) === String(sessionId));
      const statusCounts = payloadBySession.reduce((acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      }, {});

      return recordMapelAuditLog({
        sessionId,
        actionType: MAPEL_AUDIT_ACTION.ATTENDANCE_MANUAL_SAVE,
        actorName: options.actorName,
        metadata: {
          source: options.source ?? 'manual_click',
          total_entries: payloadBySession.length,
          status_counts: statusCounts,
        },
      });
    }),
  );
};

export const fetchStudentAttendanceBySession = async (sessionId) => {
  assertRequired('sessionId', sessionId);
  await assertSessionOwnershipOrThrow(sessionId);

  const { data, error } = await supabase
    .from('student_attendance_mapel')
    .select('*, siswa(nama_siswa, nis, kelas_id)')
    .eq('session_id', sessionId);

  if (error) throw error;
  return data || [];
};

export const upsertDailyScore = async ({ sessionId, siswaId, nilai, catatan }) => {
  assertRequired('sessionId', sessionId);
  assertRequired('siswaId', siswaId);
  await assertSessionOwnershipOrThrow(sessionId);

  const payload = {
    session_id: sessionId,
    siswa_id: siswaId,
    nilai,
    catatan: catatan ?? null,
  };

  const { data, error } = await supabase
    .from('daily_score')
    .upsert(payload, { onConflict: 'session_id,siswa_id' })
    .select('*')
    .single();

  if (error) throw error;
  return data;
};

export const fetchDailyScoreBySession = async (sessionId) => {
  assertRequired('sessionId', sessionId);
  await assertSessionOwnershipOrThrow(sessionId);

  const { data, error } = await supabase
    .from('daily_score')
    .select('*, siswa(nama_siswa, nis)')
    .eq('session_id', sessionId);

  if (error) throw error;
  return data || [];
};

export const createTeacherAbsenceTask = async ({ sessionId, filePath, instruksi }) => {
  assertRequired('sessionId', sessionId);
  assertRequired('instruksi', instruksi);
  await assertSessionOwnershipOrThrow(sessionId);

  const payload = {
    session_id: sessionId,
    file_path: filePath ?? null,
    instruksi,
  };

  const { data, error } = await supabase
    .from('teacher_absence_task')
    .insert([payload])
    .select('*')
    .single();

  if (error) throw error;
  return data;
};

export const markTeacherAbsenceTaskDelivered = async (taskId) => {
  assertRequired('taskId', taskId);
  const actor = assertPiketAccessOrThrow();

  const { data, error } = await supabase
    .from('teacher_absence_task')
    .update({
      delivered_by_picket: true,
      delivered_at: new Date().toISOString(),
    })
    .eq('id', taskId)
    .select('*')
    .single();

  if (error) throw error;
  if (!data?.session_id) {
    throw new Error('Task pengganti tidak valid.');
  }
  let auditWarning = null;
  try {
    await recordMapelAuditLog({
      sessionId: data.session_id,
      actionType: MAPEL_AUDIT_ACTION.TASK_DELIVERED_BY_PICKET,
      actorName: actor.nama_lengkap || actor.username || 'Piket',
      metadata: {
        source: 'piket_delivery',
        task_id: data.id,
        delivered_by_picket: true,
        delivered_at: data.delivered_at ?? null,
      },
    });
  } catch (error) {
    if (!isAuditActionConstraintMismatch(error)) {
      throw error;
    }

    auditWarning =
      'Distribusi berhasil, tetapi audit action belum didukung skema DB. Jalankan migrasi update_mapel_audit_log_actions.sql.';
  }

  return {
    ...data,
    audit_warning: auditWarning,
  };
};

export const fetchTeacherAbsenceTaskBySession = async (sessionId) => {
  assertRequired('sessionId', sessionId);
  await assertSessionOwnershipOrThrow(sessionId);
  const { data, error } = await supabase
    .from('teacher_absence_task')
    .select('*')
    .eq('session_id', sessionId)
    .maybeSingle();

  if (error) throw error;
  return data;
};

const buildDailySlaMonitoringRows = async ({ schedules, targetDate, nowMinutes }) => {
  if (!schedules?.length) {
    return {
      summary: { total: 0, warning: 0, checkedIn: 0, absent: 0, onWindow: 0 },
      rows: [],
    };
  }

  const scheduleIds = schedules.map((item) => item.id);
  const guruIds = [...new Set(schedules.map((item) => item.guru_id).filter(Boolean))];
  const [{ data: sessionRows, error: sessionError }, { data: guruRows, error: guruError }] = await Promise.all([
    supabase
      .from('session')
      .select('id, schedule_id, status, waktu_check_in, waktu_check_out, tanggal')
      .eq('tanggal', targetDate)
      .in('schedule_id', scheduleIds),
    guruIds.length
      ? supabase.from('walikelas').select('id, nama_lengkap').in('id', guruIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (sessionError) throw sessionError;
  if (guruError) throw guruError;

  const sessionMap = new Map((sessionRows || []).map((row) => [String(row.schedule_id), row]));
  const guruMap = new Map((guruRows || []).map((row) => [String(row.id), row.nama_lengkap]));
  const sessionIds = (sessionRows || []).map((row) => row.id);
  const taskMap = new Map();
  if (sessionIds.length > 0) {
    const { data: tasks, error: taskError } = await supabase
      .from('teacher_absence_task')
      .select('id, session_id, delivered_by_picket, delivered_at')
      .in('session_id', sessionIds);
    if (taskError) throw taskError;
    (tasks || []).forEach((task) => {
      taskMap.set(String(task.session_id), task);
    });
  }

  const rows = schedules
    .map((schedule) => {
      const startMinutes = normalizeTimeToMinutes(schedule.jam_mulai, 'jam_mulai');
      const graceDeadline = startMinutes + SLA_GURU_KOSONG_MINUTES;
      const session = sessionMap.get(String(schedule.id)) || null;
      const task = session ? taskMap.get(String(session.id)) ?? null : null;
      const statusNormalized = normalizeSessionStatus(session?.status);
      const hasCheckIn = Boolean(session?.waktu_check_in);
      const checkInMinutes = hasCheckIn
        ? (() => {
            const parts = new Intl.DateTimeFormat('en-US', {
              timeZone: 'Asia/Jakarta',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            }).formatToParts(new Date(session.waktu_check_in));
            const map = {};
            parts.forEach((part) => {
              map[part.type] = part.value;
            });
            return Number.parseInt(map.hour || '0', 10) * 60 + Number.parseInt(map.minute || '0', 10);
          })()
        : null;

      if (statusNormalized === 'tidak masuk' || statusNormalized === 'absent') {
        return {
          type: 'absent',
          urgencyMinutes: 0,
          schedule,
          session,
          task,
          warningLabel: task?.delivered_by_picket ? 'Tugas sudah didistribusikan' : 'Menunggu distribusi tugas',
        };
      }

      if (hasCheckIn) {
        const lateMinutes = Math.max(0, (checkInMinutes ?? startMinutes) - graceDeadline);
        return {
          type: 'checked_in',
          urgencyMinutes: lateMinutes,
          schedule,
          session,
          task,
          warningLabel: lateMinutes > 0 ? `Check-in telat ${lateMinutes} menit` : 'Check-in tepat waktu',
        };
      }

      if (nowMinutes > graceDeadline) {
        return {
          type: 'warning',
          urgencyMinutes: nowMinutes - graceDeadline,
          schedule,
          session,
          task,
          warningLabel: `Lewat SLA ${nowMinutes - graceDeadline} menit`,
        };
      }

      return {
        type: 'on_window',
        urgencyMinutes: 0,
        schedule,
        session,
        task,
        warningLabel: `Masih dalam jendela SLA (${Math.max(0, graceDeadline - nowMinutes)} menit lagi)`,
      };
    })
    .map((item) => ({
      id: item.schedule.id,
      schedule_id: item.schedule.id,
      session_id: item.session?.id ?? null,
      guru_id: item.schedule.guru_id,
      guru_nama: guruMap.get(String(item.schedule.guru_id)) || 'Guru',
      kelas_id: item.schedule.kelas_id,
      kelas_nama: item.schedule.master_kelas?.nama_kelas || '-',
      mapel_id: item.schedule.mapel_id,
      mapel_nama: item.schedule.master_mapel?.nama_mapel || '-',
      hari: item.schedule.hari,
      jam_mulai: item.schedule.jam_mulai,
      jam_selesai: item.schedule.jam_selesai,
      type: item.type,
      warning_label: item.warningLabel,
      urgency_minutes: item.urgencyMinutes,
      delivered_by_picket: Boolean(item.task?.delivered_by_picket),
      task_id: item.task?.id ?? null,
      session_status: item.session?.status ?? 'Belum Check-In',
      waktu_check_in: item.session?.waktu_check_in ?? null,
      waktu_check_out: item.session?.waktu_check_out ?? null,
    }))
    .sort((a, b) => {
      const rank = { warning: 0, absent: 1, on_window: 2, checked_in: 3 };
      const rankDiff = (rank[a.type] ?? 99) - (rank[b.type] ?? 99);
      if (rankDiff !== 0) return rankDiff;
      return (b.urgency_minutes || 0) - (a.urgency_minutes || 0);
    });

  const summary = rows.reduce(
    (acc, row) => {
      acc.total += 1;
      if (row.type === 'warning') acc.warning += 1;
      if (row.type === 'checked_in') acc.checkedIn += 1;
      if (row.type === 'absent') acc.absent += 1;
      if (row.type === 'on_window') acc.onWindow += 1;
      return acc;
    },
    { total: 0, warning: 0, checkedIn: 0, absent: 0, onWindow: 0 },
  );

  return { summary, rows };
};

export const fetchGuruKosongEws = async ({ tanggal, kelasId } = {}) => {
  assertPiketAccessOrThrow();
  const targetDate = tanggal || getTodayDateWIB();
  const targetHolidaySet = await fetchSchoolHolidaySetInRange({ fromDate: targetDate, toDate: targetDate });
  if (!isActiveSchoolDate(targetDate, targetHolidaySet)) {
    return {
      summary: { total: 0, warning: 0, checkedIn: 0, absent: 0, onWindow: 0 },
      rows: [],
    };
  }
  const targetDay = getDayNameWIB(targetDate);
  const nowMinutes = targetDate === getTodayDateWIB() ? getWibMinutesNow() : 24 * 60;

  let scheduleQuery = supabase
    .from('schedule')
    .select('id, guru_id, kelas_id, mapel_id, hari, jam_mulai, jam_selesai, master_kelas(nama_kelas), master_mapel(nama_mapel)')
    .eq('hari', targetDay)
    .order('jam_mulai', { ascending: true });

  if (kelasId) {
    scheduleQuery = scheduleQuery.eq('kelas_id', Number(kelasId));
  }

  const { data: schedules, error: scheduleError } = await scheduleQuery;
  if (scheduleError) throw scheduleError;

  return buildDailySlaMonitoringRows({ schedules, targetDate, nowMinutes });
};

export const fetchExecutiveDailyMonitoring = async ({ tanggal, kelasId } = {}) => {
  const scope = await resolveExecutiveScopeOrThrow();
  const targetDate = tanggal || getTodayDateWIB();
  const targetHolidaySet = await fetchSchoolHolidaySetInRange({ fromDate: targetDate, toDate: targetDate });
  if (!isActiveSchoolDate(targetDate, targetHolidaySet)) {
    return {
      summary: { total: 0, warning: 0, checkedIn: 0, absent: 0, onWindow: 0 },
      rows: [],
    };
  }
  const targetDay = getDayNameWIB(targetDate);
  const nowMinutes = targetDate === getTodayDateWIB() ? getWibMinutesNow() : 24 * 60;

  let allowedKelasIds = null;
  if (scope.isJurusanScoped) {
    const { data: kelasRows, error: kelasError } = await supabase
      .from('master_kelas')
      .select('id')
      .eq('jurusan_id', scope.jurusanId);
    if (kelasError) throw kelasError;
    allowedKelasIds = (kelasRows || []).map((item) => Number(item.id)).filter((id) => Number.isInteger(id));
    if (allowedKelasIds.length === 0) {
      return {
        summary: { total: 0, warning: 0, checkedIn: 0, absent: 0, onWindow: 0 },
        rows: [],
      };
    }
  }

  const requestedKelasId = kelasId ? Number(kelasId) : null;
  if (requestedKelasId && allowedKelasIds && !allowedKelasIds.includes(requestedKelasId)) {
    return {
      summary: { total: 0, warning: 0, checkedIn: 0, absent: 0, onWindow: 0 },
      rows: [],
    };
  }

  let scheduleQuery = supabase
    .from('schedule')
    .select('id, guru_id, kelas_id, mapel_id, hari, jam_mulai, jam_selesai, master_kelas(nama_kelas), master_mapel(nama_mapel)')
    .eq('hari', targetDay)
    .order('jam_mulai', { ascending: true });

  if (requestedKelasId) {
    scheduleQuery = scheduleQuery.eq('kelas_id', requestedKelasId);
  } else if (allowedKelasIds) {
    scheduleQuery = scheduleQuery.in('kelas_id', allowedKelasIds);
  }

  const { data: schedules, error: scheduleError } = await scheduleQuery;
  if (scheduleError) throw scheduleError;

  return buildDailySlaMonitoringRows({ schedules, targetDate, nowMinutes });
};

export const fetchExecutiveMapelKpiDataset = async ({
  fromDate,
  toDate,
  kelasId,
  mapelId,
  guruId,
  trendBy = 'guru_nama',
  nowMinutes,
} = {}) => {
  const scope = await resolveExecutiveScopeOrThrow();
  const endDate = toDate || getTodayDateWIB();
  const startDate = fromDate || (() => {
    const d = toWibDateTime(endDate);
    d.setDate(d.getDate() - 6);
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  })();

  let kelasScopeQuery = supabase.from('master_kelas').select('id, jurusan_id');
  if (scope.isJurusanScoped) {
    kelasScopeQuery = kelasScopeQuery.eq('jurusan_id', scope.jurusanId);
  }

  const { data: kelasScopeRows, error: kelasScopeError } = await kelasScopeQuery;
  if (kelasScopeError) throw kelasScopeError;

  const allowedKelasIds = new Set((kelasScopeRows || []).map((row) => Number(row.id)).filter((id) => Number.isInteger(id)));
  if (allowedKelasIds.size === 0) {
    return {
      summary: {
        fromDate: startDate,
        toDate: endDate,
        totalSessions: 0,
        totalScheduled: 0,
        totalTeachers: 0,
        totalHadir: 0,
        totalTidakMasuk: 0,
        totalLate: 0,
        presenceRate: 0,
        lateRate: 0,
        tidakMasukRate: 0,
        slaBreachRate: 0,
        impactedClasses: 0,
      },
      teacherRows: [],
      trendRows: [],
      impactedRows: [],
      alertRows: [],
    };
  }

  const requestedKelasId = kelasId ? Number(kelasId) : null;
  if (requestedKelasId && !allowedKelasIds.has(requestedKelasId)) {
    return {
      summary: {
        fromDate: startDate,
        toDate: endDate,
        totalSessions: 0,
        totalScheduled: 0,
        totalTeachers: 0,
        totalHadir: 0,
        totalTidakMasuk: 0,
        totalLate: 0,
        presenceRate: 0,
        lateRate: 0,
        tidakMasukRate: 0,
        slaBreachRate: 0,
        impactedClasses: 0,
      },
      teacherRows: [],
      trendRows: [],
      impactedRows: [],
      alertRows: [],
    };
  }

  let scheduleQuery = supabase
    .from('schedule')
    .select('id, guru_id, kelas_id, mapel_id, jam_mulai, jam_selesai, master_kelas(nama_kelas), master_mapel(nama_mapel)');

  if (requestedKelasId) {
    scheduleQuery = scheduleQuery.eq('kelas_id', requestedKelasId);
  } else {
    scheduleQuery = scheduleQuery.in('kelas_id', [...allowedKelasIds]);
  }

  if (mapelId) {
    scheduleQuery = scheduleQuery.eq('mapel_id', Number(mapelId));
  }
  if (guruId) {
    scheduleQuery = scheduleQuery.eq('guru_id', String(guruId));
  }

  const { data: scheduleRows, error: scheduleError } = await scheduleQuery;
  if (scheduleError) throw scheduleError;

  const schedules = scheduleRows || [];
  if (schedules.length === 0) {
    return {
      summary: {
        fromDate: startDate,
        toDate: endDate,
        totalSessions: 0,
        totalScheduled: 0,
        totalTeachers: 0,
        totalHadir: 0,
        totalTidakMasuk: 0,
        totalLate: 0,
        presenceRate: 0,
        lateRate: 0,
        tidakMasukRate: 0,
        slaBreachRate: 0,
        impactedClasses: 0,
      },
      teacherRows: [],
      trendRows: [],
      impactedRows: [],
      alertRows: [],
    };
  }

  const scheduleIds = schedules.map((row) => row.id);
  const guruIds = [...new Set(schedules.map((row) => row.guru_id).filter(Boolean))];

  const [{ data: sessionRows, error: sessionError }, { data: guruRows, error: guruError }] = await Promise.all([
    supabase
      .from('session')
      .select('id, schedule_id, tanggal, status, waktu_check_in, waktu_check_out')
      .in('schedule_id', scheduleIds)
      .gte('tanggal', startDate)
      .lte('tanggal', endDate),
    guruIds.length
      ? supabase.from('walikelas').select('id, nama_lengkap').in('id', guruIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (sessionError) throw sessionError;
  if (guruError) throw guruError;

  const holidaySet = await fetchSchoolHolidaySetInRange({ fromDate: startDate, toDate: endDate });
  const activeSessionRows = filterActiveSchoolSessionRows(sessionRows || [], holidaySet);

  const guruMap = new Map((guruRows || []).map((row) => [String(row.id), row.nama_lengkap]));
  const scheduleMap = new Map(schedules.map((row) => [String(row.id), row]));

  const rows = activeSessionRows.map((row) => {
    const schedule = scheduleMap.get(String(row.schedule_id)) || null;
    const statusNorm = normalizeSessionStatus(row.status);
    const isTidakMasuk = statusNorm === 'tidak masuk' || statusNorm === 'absent';
    const hasCheckIn = Boolean(row.waktu_check_in);

    let isLate = false;
    if (hasCheckIn && schedule?.jam_mulai) {
      const checkInParts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Jakarta',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(new Date(row.waktu_check_in));
      const map = {};
      checkInParts.forEach((part) => {
        map[part.type] = part.value;
      });
      const checkInMinutes = Number.parseInt(map.hour || '0', 10) * 60 + Number.parseInt(map.minute || '0', 10);
      const startMinutes = normalizeTimeToMinutes(schedule.jam_mulai, 'jam_mulai');
      isLate = checkInMinutes > startMinutes + LATE_CHECKIN_TOLERANCE_MINUTES;
    }

    return {
      session_id: row.id,
      schedule_id: row.schedule_id,
      tanggal: row.tanggal,
      statusNorm: isTidakMasuk ? 'tidak masuk' : hasCheckIn ? 'hadir' : 'pending',
      isLate,
      guru_id: schedule?.guru_id ?? null,
      guru_nama: guruMap.get(String(schedule?.guru_id || '')) || 'Guru',
      kelas_id: schedule?.kelas_id ?? null,
      kelas_nama: schedule?.master_kelas?.nama_kelas || '-',
      mapel_id: schedule?.mapel_id ?? null,
      mapel_nama: schedule?.master_mapel?.nama_mapel || '-',
      jam_mulai: schedule?.jam_mulai || null,
      waktu_check_in: row.waktu_check_in || null,
      waktu_check_out: row.waktu_check_out || null,
    };
  });

  const teacherMap = new Map();
  rows.forEach((row) => {
    const guruIdKey = String(row.guru_id || '');
    if (!guruIdKey) return;
    const current = teacherMap.get(guruIdKey) || {
      guru_id: guruIdKey,
      guru_nama: row.guru_nama,
      total_sessions: 0,
      hadir_sessions: 0,
      tidak_masuk_sessions: 0,
      telat_sessions: 0,
      pending_sessions: 0,
      check_in_sessions: 0,
      check_out_sessions: 0,
      kelas_terakhir: row.kelas_nama,
      mapel_terakhir: row.mapel_nama,
    };

    current.total_sessions += 1;
    if (row.statusNorm === 'hadir') current.hadir_sessions += 1;
    else if (row.statusNorm === 'tidak masuk') current.tidak_masuk_sessions += 1;
    else current.pending_sessions += 1;
    if (row.isLate) current.telat_sessions += 1;
    if (row.waktu_check_in) current.check_in_sessions += 1;
    if (row.waktu_check_out) current.check_out_sessions += 1;

    teacherMap.set(guruIdKey, current);
  });

  const teacherRows = [...teacherMap.values()].map((row) => {
    const rates = computeTeacherRates({
      totalScheduled: row.total_sessions,
      totalHadir: row.hadir_sessions,
      totalTidakMasuk: row.tidak_masuk_sessions,
      totalLate: row.telat_sessions,
    });
    return {
      ...row,
      presence_rate: rates.presenceRate,
      late_rate: rates.lateRate,
      tidak_masuk_rate: rates.tidakMasukRate,
      check_out_rate:
        row.check_in_sessions > 0
          ? Math.round((row.check_out_sessions / row.check_in_sessions) * 1000) / 10
          : null,
    };
  });

  const totalSessions = rows.length;
  const totalScheduled = rows.length;
  const totalHadir = rows.filter((row) => row.statusNorm === 'hadir').length;
  const totalTidakMasuk = rows.filter((row) => row.statusNorm === 'tidak masuk').length;
  const totalLate = rows.filter((row) => row.isLate).length;
  const totalCheckIns = rows.filter((row) => Boolean(row.waktu_check_in)).length;
  const totalCheckOuts = rows.filter((row) => Boolean(row.waktu_check_out)).length;

  const resolvedNowMinutes = Number.isFinite(nowMinutes) ? Number(nowMinutes) : getWibMinutesNow();
  const todayWib = getTodayDateWIB();
  const impactedSource = rows.map((row) => {
    const startMinutes = row.jam_mulai ? normalizeTimeToMinutes(row.jam_mulai, 'jam_mulai') : 0;
    let breach = false;
    if (row.tanggal < todayWib) {
      breach = !row.waktu_check_in;
    } else if (row.tanggal === todayWib) {
      breach = computeSlaBreach({
        startMinutes,
        nowMinutes: resolvedNowMinutes,
        hasCheckIn: Boolean(row.waktu_check_in),
      }).isBreach;
    }
    return {
      tanggal: row.tanggal,
      kelas_id: row.kelas_id,
      breached: breach,
      ...row,
    };
  });

  const impactedRows = buildImpactedClassBuckets(impactedSource);
  const breachedRows = impactedSource.filter((row) => row.breached);
  const impactedClasses = new Set(breachedRows.map((row) => String(row.kelas_id || ''))).size;
  const slaBreachRate = totalScheduled > 0 ? Math.round((breachedRows.length / totalScheduled) * 1000) / 10 : 0;

  const summaryRates = computeTeacherRates({
    totalScheduled,
    totalHadir,
    totalTidakMasuk,
    totalLate,
  });

  const trendDimension = ['guru_nama', 'kelas_nama', 'mapel_nama'].includes(String(trendBy))
    ? String(trendBy)
    : 'guru_nama';

  return {
    summary: {
      fromDate: startDate,
      toDate: endDate,
      totalSessions,
      totalScheduled,
      totalTeachers: teacherRows.length,
      totalHadir,
      totalTidakMasuk,
      totalLate,
      totalCheckIns,
      totalCheckOuts,
      presenceRate: summaryRates.presenceRate,
      lateRate: summaryRates.lateRate,
      tidakMasukRate: summaryRates.tidakMasukRate,
      slaBreachRate,
      impactedClasses,
      roleScope: scope.isJurusanScoped ? 'jurusan' : 'global',
      jurusanId: scope.jurusanId,
    },
    teacherRows: teacherRows.sort((a, b) => {
      if (b.late_rate !== a.late_rate) return b.late_rate - a.late_rate;
      return b.total_sessions - a.total_sessions;
    }),
    trendRows: buildTrendBuckets(rows, trendDimension),
    impactedRows,
    alertRows: breachedRows
      .sort((a, b) => String(a.tanggal).localeCompare(String(b.tanggal)))
      .slice(0, 50)
      .map((row) => ({
        session_id: row.session_id,
        tanggal: row.tanggal,
        kelas_nama: row.kelas_nama,
        mapel_nama: row.mapel_nama,
        guru_nama: row.guru_nama,
        warning_label: 'Melewati SLA 15 menit tanpa check-in',
      })),
  };
};

export const fetchTeacherAbsenceTasksForPicket = async ({ tanggal, kelasId, deliveryStatus = 'all' } = {}) => {
  assertPiketAccessOrThrow();
  const targetDate = tanggal || getTodayDateWIB();
  let sessionQuery = supabase
    .from('session')
    .select('id, tanggal, status, schedule!inner(id, guru_id, kelas_id, jam_mulai, jam_selesai, master_kelas(nama_kelas), master_mapel(nama_mapel))')
    .eq('tanggal', targetDate)
    .eq('status', SESSION_STATUS.TIDAK_MASUK)
    .order('created_at', { ascending: false })
    .limit(300);

  if (kelasId) {
    sessionQuery = sessionQuery.eq('schedule.kelas_id', Number(kelasId));
  }

  const { data: sessions, error: sessionError } = await sessionQuery;
  if (sessionError) throw sessionError;
  const sessionIds = (sessions || []).map((row) => row.id);
  if (sessionIds.length === 0) return { rows: [] };

  const guruIds = [...new Set((sessions || []).map((row) => row.schedule?.guru_id).filter(Boolean))];
  const [{ data: tasks, error: taskError }, { data: guruRows, error: guruError }] = await Promise.all([
    supabase
      .from('teacher_absence_task')
      .select('id, session_id, instruksi, file_path, delivered_by_picket, delivered_at, created_at')
      .in('session_id', sessionIds)
      .order('created_at', { ascending: false }),
    guruIds.length
      ? supabase.from('walikelas').select('id, nama_lengkap').in('id', guruIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (taskError) throw taskError;
  if (guruError) throw guruError;

  const sessionMap = new Map((sessions || []).map((row) => [String(row.id), row]));
  const guruMap = new Map((guruRows || []).map((row) => [String(row.id), row.nama_lengkap]));
  let rows = (tasks || [])
    .map((task) => {
      const session = sessionMap.get(String(task.session_id));
      return {
        ...task,
        kelas_id: session?.schedule?.kelas_id ?? null,
        kelas_nama: session?.schedule?.master_kelas?.nama_kelas || '-',
        mapel_nama: session?.schedule?.master_mapel?.nama_mapel || '-',
        jam_label: `${String(session?.schedule?.jam_mulai || '').slice(0, 5)}-${String(session?.schedule?.jam_selesai || '').slice(0, 5)}`,
        guru_id: session?.schedule?.guru_id ?? null,
        guru_nama: guruMap.get(String(session?.schedule?.guru_id ?? '')) || 'Guru',
        tanggal: session?.tanggal ?? targetDate,
      };
    })
    .sort((a, b) => {
      if (a.delivered_by_picket === b.delivered_by_picket) {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      return a.delivered_by_picket ? 1 : -1;
    });

  if (deliveryStatus === 'pending') {
    rows = rows.filter((row) => !row.delivered_by_picket);
  } else if (deliveryStatus === 'delivered') {
    rows = rows.filter((row) => row.delivered_by_picket);
  }

  return { rows };
};

export const fetchMapelTeacherPerformance = async ({ fromDate, toDate, kelasId, trendBy, limit = 200 } = {}) => {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 1000) : 200;
  const dataset = await fetchExecutiveMapelKpiDataset({
    fromDate,
    toDate,
    kelasId,
    trendBy,
  });

  const limitedRows = (dataset.teacherRows || []).slice(0, safeLimit);

  return {
    summary: {
      totalSessions: dataset.summary?.totalSessions || 0,
      totalTeachers: dataset.summary?.totalTeachers || 0,
      totalCheckIns: dataset.summary?.totalCheckIns || 0,
      totalCheckOuts: dataset.summary?.totalCheckOuts || 0,
      averagePresenceRate: dataset.summary?.presenceRate || 0,
      averageLateRate: dataset.summary?.lateRate || 0,
      fromDate: dataset.summary?.fromDate || fromDate || getTodayDateWIB(),
      toDate: dataset.summary?.toDate || toDate || getTodayDateWIB(),
      tidakMasukRate: dataset.summary?.tidakMasukRate || 0,
      slaBreachRate: dataset.summary?.slaBreachRate || 0,
      impactedClasses: dataset.summary?.impactedClasses || 0,
      roleScope: dataset.summary?.roleScope || 'global',
    },
    rows: limitedRows,
    trendRows: dataset.trendRows || [],
    alertRows: dataset.alertRows || [],
    impactedRows: dataset.impactedRows || [],
  };
};

export const fetchMapelAuditTrail = async ({
  fromDate,
  toDate,
  actionType = 'all',
  actorId,
  kelasId,
  mapelId,
  page = 1,
  pageSize = 25,
} = {}) => {
  const session = getSessionOrThrow();
  const role = normalizeRole(session.role);
  const canReadGlobal = isMapelAuditRole(role);

  if (!canReadGlobal) {
    throw new Error('Akses audit trail mapel ditolak untuk role ini.');
  }

  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.min(Math.floor(pageSize), 200) : 25;
  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize - 1;
  let filteredSessionIds = null;

  if (kelasId || mapelId) {
    let sessionFilterQuery = supabase
      .from('session')
      .select('id, schedule!inner(kelas_id, mapel_id)');

    if (kelasId) {
      sessionFilterQuery = sessionFilterQuery.eq('schedule.kelas_id', Number(kelasId));
    }
    if (mapelId) {
      sessionFilterQuery = sessionFilterQuery.eq('schedule.mapel_id', Number(mapelId));
    }

    const { data: filteredSessions, error: filteredSessionError } = await sessionFilterQuery;
    if (filteredSessionError) throw filteredSessionError;
    filteredSessionIds = (filteredSessions || []).map((row) => String(row.id));
    if (filteredSessionIds.length === 0) {
      return {
        rows: [],
        total: 0,
        page: safePage,
        pageSize: safePageSize,
        totalPages: 1,
      };
    }
  }

  let query = supabase
    .from('mapel_audit_log')
    .select('id, session_id, actor_id, actor_name, actor_role, action_type, metadata, created_at', {
      count: 'exact',
    })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (fromDate) {
    query = query.gte('created_at', `${fromDate}T00:00:00`);
  }
  if (toDate) {
    query = query.lte('created_at', `${toDate}T23:59:59`);
  }
  if (actionType && actionType !== 'all') {
    query = query.eq('action_type', actionType);
  }
  if (actorId) {
    query = query.eq('actor_id', String(actorId));
  }
  if (filteredSessionIds) {
    query = query.in('session_id', filteredSessionIds);
  }

  const { data: auditRows, error: auditError, count } = await query;
  if (auditError) throw auditError;

  const sessionIds = [...new Set((auditRows || []).map((row) => row.session_id).filter(Boolean))];
  if (sessionIds.length === 0) {
    return {
      rows: [],
      total: count || 0,
      page: safePage,
      pageSize: safePageSize,
      totalPages: Math.max(1, Math.ceil((count || 0) / safePageSize)),
    };
  }

  const { data: sessionRows, error: sessionError } = await supabase
    .from('session')
    .select('id, tanggal, status, schedule:schedule_id(id, hari, jam_mulai, jam_selesai, guru_id, kelas_id, mapel_id, master_kelas(nama_kelas), master_mapel(nama_mapel, kode_mapel))')
    .in('id', sessionIds);
  if (sessionError) throw sessionError;

  const sessionMap = new Map((sessionRows || []).map((row) => [String(row.id), row]));

  const rows = (auditRows || []).map((row) => {
    const matchedSession = sessionMap.get(String(row.session_id));
    return {
      ...row,
      session: matchedSession ?? null,
      session_tanggal: matchedSession?.tanggal ?? null,
      session_status: matchedSession?.status ?? null,
      kelas_nama: matchedSession?.schedule?.master_kelas?.nama_kelas ?? '-',
      mapel_nama: matchedSession?.schedule?.master_mapel?.nama_mapel ?? '-',
      mapel_kode: matchedSession?.schedule?.master_mapel?.kode_mapel ?? '-',
      jam_label: matchedSession?.schedule
        ? `${String(matchedSession.schedule.jam_mulai || '').slice(0, 5)}-${String(matchedSession.schedule.jam_selesai || '').slice(0, 5)}`
        : '-',
    };
  });

  return {
    rows,
    total: count || 0,
    page: safePage,
    pageSize: safePageSize,
    totalPages: Math.max(1, Math.ceil((count || 0) / safePageSize)),
  };
};

export const fetchMapelAuditSessionSummary = async ({
  fromDate,
  toDate,
  kelasId,
  mapelId,
  page = 1,
  pageSize = 20,
} = {}) => {
  const scope = await resolveExecutiveScopeOrThrow();
  if (!isMapelAuditRole(scope.role) && scope.role !== 'admin') {
    throw new Error('Akses audit trail mapel ditolak untuk role ini.');
  }

  let kelasScopeQuery = supabase.from('master_kelas').select('id, jurusan_id');
  if (scope.isJurusanScoped) {
    kelasScopeQuery = kelasScopeQuery.eq('jurusan_id', scope.jurusanId);
  }
  const { data: kelasScopeRows, error: kelasScopeError } = await kelasScopeQuery;
  if (kelasScopeError) throw kelasScopeError;
  const allowedKelasIds = new Set((kelasScopeRows || []).map((row) => Number(row.id)).filter((id) => Number.isInteger(id)));
  if (allowedKelasIds.size === 0) {
    return {
      rows: [],
      total: 0,
      page: 1,
      pageSize: Number.isFinite(pageSize) && pageSize > 0 ? Math.min(Math.floor(pageSize), 200) : 20,
      totalPages: 1,
    };
  }

  const requestedKelasId = kelasId ? Number(kelasId) : null;
  if (requestedKelasId && !allowedKelasIds.has(requestedKelasId)) {
    return {
      rows: [],
      total: 0,
      page: 1,
      pageSize: Number.isFinite(pageSize) && pageSize > 0 ? Math.min(Math.floor(pageSize), 200) : 20,
      totalPages: 1,
    };
  }

  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.min(Math.floor(pageSize), 200) : 20;
  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize - 1;

  let query = supabase
    .from('session')
    .select(
      'id, tanggal, status, waktu_check_in, foto_check_in, waktu_check_out, foto_check_out, schedule:schedule_id!inner(id, guru_id, kelas_id, mapel_id, hari, jam_mulai, jam_selesai, master_kelas(nama_kelas), master_mapel(nama_mapel, kode_mapel))',
    )
    .order('tanggal', { ascending: false })
    .order('created_at', { ascending: false });

  if (fromDate) {
    query = query.gte('tanggal', fromDate);
  }
  if (toDate) {
    query = query.lte('tanggal', toDate);
  }
  if (requestedKelasId) {
    query = query.eq('schedule.kelas_id', requestedKelasId);
  } else {
    query = query.in('schedule.kelas_id', [...allowedKelasIds]);
  }
  if (mapelId) {
    query = query.eq('schedule.mapel_id', Number(mapelId));
  }

  const { data: sessionRows, error: sessionError } = await query;
  if (sessionError) throw sessionError;

  const holidaySet = await fetchSchoolHolidaySetInRange({
    fromDate: fromDate || getTodayDateWIB(),
    toDate: toDate || getTodayDateWIB(),
  });
  const activeRows = filterActiveSchoolSessionRows(sessionRows || [], holidaySet);
  const totalFiltered = activeRows.length;
  const rows = activeRows.slice(from, to + 1);

  if (rows.length === 0) {
    return {
      rows: [],
      total: totalFiltered,
      page: safePage,
      pageSize: safePageSize,
      totalPages: Math.max(1, Math.ceil(totalFiltered / safePageSize)),
    };
  }

  const sessionIds = rows.map((row) => row.id);
  const guruIds = [...new Set(rows.map((row) => row.schedule?.guru_id).filter(Boolean))];

  const [
    { data: agendaRows, error: agendaError },
    { data: attendanceRows, error: attendanceError },
    { data: absenceTaskRows, error: taskError },
    { data: guruRows, error: guruError },
  ] = await Promise.all([
    supabase.from('class_agenda').select('session_id, topik, metode').in('session_id', sessionIds),
    supabase.from('student_attendance_mapel').select('session_id, status').in('session_id', sessionIds),
    supabase
      .from('teacher_absence_task')
      .select('session_id, instruksi, file_path, delivered_by_picket, delivered_at')
      .in('session_id', sessionIds),
    guruIds.length
      ? supabase.from('walikelas').select('id, nama_lengkap').in('id', guruIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (agendaError) throw agendaError;
  if (attendanceError) throw attendanceError;
  if (taskError) throw taskError;
  if (guruError) throw guruError;

  const agendaMap = new Map((agendaRows || []).map((row) => [String(row.session_id), row]));
  const taskMap = new Map((absenceTaskRows || []).map((row) => [String(row.session_id), row]));
  const guruMap = new Map((guruRows || []).map((row) => [String(row.id), row.nama_lengkap]));

  const attendanceMap = new Map();
  (attendanceRows || []).forEach((row) => {
    const key = String(row.session_id);
    const existing = attendanceMap.get(key) || { hadir: 0, sakit: 0, izin: 0, alpha: 0, total: 0 };
    const normalizedStatus = ATTENDANCE_STATUS_MAP[String(row.status || '').trim().toUpperCase()] || String(row.status || '');
    if (normalizedStatus === 'Hadir') existing.hadir += 1;
    if (normalizedStatus === 'Sakit') existing.sakit += 1;
    if (normalizedStatus === 'Izin') existing.izin += 1;
    if (normalizedStatus === 'Alpha') existing.alpha += 1;
    existing.total += 1;
    attendanceMap.set(key, existing);
  });

  const normalizedRows = rows.map((row) => {
    const schedule = row.schedule || {};
    const summary = attendanceMap.get(String(row.id)) || { hadir: 0, sakit: 0, izin: 0, alpha: 0, total: 0 };
    const agenda = agendaMap.get(String(row.id)) || null;
    const absenceTask = taskMap.get(String(row.id)) || null;
    const jamMulai = String(schedule.jam_mulai || '').slice(0, 5);
    const jamSelesai = String(schedule.jam_selesai || '').slice(0, 5);

    return {
      ...row,
      guru_id: schedule.guru_id ?? null,
      guru_nama: guruMap.get(String(schedule.guru_id || '')) || 'Guru',
      kelas_nama: schedule.master_kelas?.nama_kelas || '-',
      mapel_nama: schedule.master_mapel?.nama_mapel || '-',
      mapel_kode: schedule.master_mapel?.kode_mapel || '-',
      hari: schedule.hari || '-',
      jam_label: jamMulai && jamSelesai ? `${jamMulai}-${jamSelesai}` : '-',
      agenda_topik: agenda?.topik || '-',
      agenda_metode: agenda?.metode || '-',
      attendance_summary: summary,
      absence_task: absenceTask,
    };
  });

  return {
    rows: normalizedRows,
    total: totalFiltered,
    page: safePage,
    pageSize: safePageSize,
    totalPages: Math.max(1, Math.ceil(totalFiltered / safePageSize)),
  };
};

export const fetchMapelAuditFilterOptions = async () => {
  const scope = await resolveExecutiveScopeOrThrow();
  const canReadGlobal = isMapelAuditRole(scope.role) || scope.role === 'admin';
  if (!canReadGlobal) {
    throw new Error('Akses filter audit mapel ditolak untuk role ini.');
  }

  let kelasQuery = supabase.from('master_kelas').select('id, nama_kelas, jurusan_id').order('nama_kelas', { ascending: true });
  if (scope.isJurusanScoped) {
    kelasQuery = kelasQuery.eq('jurusan_id', scope.jurusanId);
  }

  const [{ data: kelasData, error: kelasError }, { data: mapelData, error: mapelError }] = await Promise.all([
    kelasQuery,
    supabase.from('master_mapel').select('id, nama_mapel, kode_mapel').order('nama_mapel', { ascending: true }),
  ]);

  if (kelasError) throw kelasError;
  if (mapelError) throw mapelError;

  return {
    kelasOptions: kelasData || [],
    mapelOptions: mapelData || [],
  };
};

export const searchMapelAuditActors = async ({ searchTerm = '', limit = 20 } = {}) => {
  const session = getSessionOrThrow();
  const role = normalizeRole(session.role);
  const canReadGlobal = isMapelAuditRole(role);
  if (!canReadGlobal) {
    throw new Error('Akses pencarian actor audit ditolak untuk role ini.');
  }

  const normalizedLimit = Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 100) : 20;
  const normalizedKeyword = String(searchTerm || '').trim();

  let query = supabase
    .from('mapel_audit_log')
    .select('actor_id, actor_name, actor_role, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  if (normalizedKeyword) {
    const escapedKeyword = normalizedKeyword.replace(/[%_]/g, '');
    query = query.or(`actor_name.ilike.%${escapedKeyword}%,actor_id.ilike.%${escapedKeyword}%`);
  }

  const { data, error } = await query;
  if (error) throw error;

  const deduped = [];
  const seen = new Set();
  (data || []).forEach((item) => {
    const actorId = String(item.actor_id || '').trim();
    if (!actorId || seen.has(actorId)) return;
    seen.add(actorId);
    deduped.push({
      actor_id: actorId,
      actor_name: item.actor_name || actorId,
      actor_role: item.actor_role || '-',
    });
  });

  return deduped.slice(0, normalizedLimit);
};

export { MAPEL_AUDIT_ACTION };
export { SESSION_STATUS };
