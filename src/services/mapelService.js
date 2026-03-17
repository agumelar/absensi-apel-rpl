import { supabase } from './supabase/client';
import {
  assertGuruOwnershipOrThrow,
  assertMapelAccessOrThrow,
  getSessionOrThrow,
} from './auth/sessionService';
import { isMapelAuditRole, normalizeRole } from '../shared/constants/roles';

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

export const fetchSessionsByDateRange = async ({ fromDate, toDate }) => {
  assertRequired('fromDate', fromDate);
  assertRequired('toDate', toDate);
  const session = assertMapelAccessOrThrow();

  const { data, error } = await supabase
    .from('session')
    .select('*, schedule(*, master_mapel(nama_mapel), master_kelas(nama_kelas))')
    .gte('tanggal', fromDate)
    .lte('tanggal', toDate)
    .order('tanggal', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (session.role === 'admin') return data || [];
  return (data || []).filter((item) => String(item?.schedule?.guru_id ?? '') === String(session.walikelas_id));
};

export const createSession = async ({ scheduleId, tanggal }) => {
  assertRequired('scheduleId', scheduleId);
  assertMapelAccessOrThrow();
  const { data: scheduleData, error: scheduleError } = await supabase
    .from('schedule')
    .select('guru_id')
    .eq('id', scheduleId)
    .single();
  if (scheduleError) throw scheduleError;
  assertGuruOwnershipOrThrow(scheduleData.guru_id);

  const payload = {
    schedule_id: scheduleId,
    tanggal: tanggal ?? new Date().toISOString().slice(0, 10),
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
    },
  });
  return data;
};

export const checkOutSession = async (sessionId, fotoCheckOut, options = {}) => {
  assertRequired('sessionId', sessionId);
  assertRequired('fotoCheckOut', fotoCheckOut);
  await assertSessionOwnershipOrThrow(sessionId);

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
  const session = getSessionOrThrow();
  await assertSessionOwnershipOrThrow(sessionId);

  const payload = {
    session_id: sessionId,
    teacher_id: session.walikelas_id,
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
  assertMapelAccessOrThrow();

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
  return data;
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

export const fetchMapelAuditFilterOptions = async () => {
  const session = getSessionOrThrow();
  const role = normalizeRole(session.role);
  const canReadGlobal = isMapelAuditRole(role);
  if (!canReadGlobal) {
    throw new Error('Akses filter audit mapel ditolak untuk role ini.');
  }

  const [{ data: kelasData, error: kelasError }, { data: mapelData, error: mapelError }] = await Promise.all([
    supabase.from('master_kelas').select('id, nama_kelas').order('nama_kelas', { ascending: true }),
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
