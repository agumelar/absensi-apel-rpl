import { supabase } from '../supabaseClient';
import { getSessionOrThrow } from './auth/sessionService';
import { getTodayDateWIB } from './shared/dateService';
import { getEvidencePolicyByStatus, isBusinessWeekdayWIBDate } from '../features/pembiasaan/utils/attendancePolicyRules';
import { buildTeacherRecapRows } from '../features/pembiasaan/utils/executivePembiasaanReportRules';
import { isJurusanScopedExecutiveReportRole } from '../features/pembiasaan/utils/executivePembiasaanScopeRules';

const ACTIVITY_TYPES = {
  SAPA: 'sapa_pagi',
  PEMBIASAAN: 'pembiasaan',
};

const WEEKDAY_OPTIONS = [
  { value: 'senin', label: 'Senin' },
  { value: 'selasa', label: 'Selasa' },
  { value: 'rabu', label: 'Rabu' },
  { value: 'kamis', label: 'Kamis' },
  { value: 'jumat', label: 'Jumat' },
];

export const PEMBIASAAN_WEEKDAYS = WEEKDAY_OPTIONS;

const dayNameByIso = {
  1: 'senin',
  2: 'selasa',
  3: 'rabu',
  4: 'kamis',
  5: 'jumat',
  6: 'sabtu',
  7: 'minggu',
};

const getTodayWeekdayWIB = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    weekday: 'short',
  }).format(new Date());
  const map = {
    Mon: 'senin',
    Tue: 'selasa',
    Wed: 'rabu',
    Thu: 'kamis',
    Fri: 'jumat',
    Sat: 'sabtu',
    Sun: 'minggu',
  };
  return map[parts] || 'senin';
};

const getWeekdayFromDateWIB = (dateValue) => {
  if (!dateValue) return getTodayWeekdayWIB();
  const parsed = new Date(`${dateValue}T00:00:00+07:00`);
  if (Number.isNaN(parsed.getTime())) return getTodayWeekdayWIB();
  const shortName = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    weekday: 'short',
  }).format(parsed);
  const map = {
    Mon: 'senin',
    Tue: 'selasa',
    Wed: 'rabu',
    Thu: 'kamis',
    Fri: 'jumat',
    Sat: 'sabtu',
    Sun: 'minggu',
  };
  return map[shortName] || getTodayWeekdayWIB();
};

const normalizeHari = (hari) => {
  const raw = String(hari || '').trim().toLowerCase();
  if (dayNameByIso[Number(raw)]) return dayNameByIso[Number(raw)];
  if (WEEKDAY_OPTIONS.some((item) => item.value === raw)) return raw;
  return getTodayWeekdayWIB();
};

const getNextDateForDay = (hari) => {
  const normalizedDay = normalizeHari(hari);
  const isoByDay = {
    senin: 1,
    selasa: 2,
    rabu: 3,
    kamis: 4,
    jumat: 5,
    sabtu: 6,
    minggu: 7,
  };
  const targetIso = isoByDay[normalizedDay] || 1;

  const now = new Date();
  const wibDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
  const currentIso = ((wibDate.getDay() + 6) % 7) + 1;
  const diff = (targetIso - currentIso + 7) % 7;
  wibDate.setDate(wibDate.getDate() + diff);

  const year = wibDate.getFullYear();
  const month = String(wibDate.getMonth() + 1).padStart(2, '0');
  const day = String(wibDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toRole = (value) => String(value || '').trim().toLowerCase();
const EXCLUDED_EXECUTIVE_REPORT_ROLES = new Set(['kepsek', 'piket', 'admin']);
const isExcludedExecutiveRole = (roleValue) => EXCLUDED_EXECUTIVE_REPORT_ROLES.has(toRole(roleValue));

const normalizeDate = (value) => String(value || '').trim();

const enumerateDateRange = (fromDate, toDate) => {
  const from = normalizeDate(fromDate);
  const to = normalizeDate(toDate);
  if (!from || !to) return [];
  const start = new Date(`${from}T12:00:00+07:00`);
  const end = new Date(`${to}T12:00:00+07:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];

  const cursor = new Date(start);
  const result = [];
  while (cursor <= end) {
    const year = cursor.getUTCFullYear();
    const month = String(cursor.getUTCMonth() + 1).padStart(2, '0');
    const day = String(cursor.getUTCDate()).padStart(2, '0');
    result.push(`${year}-${month}-${day}`);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
};

const assertBusinessWeekdayOrThrow = (dateValue) => {
  const targetDate = dateValue || getTodayDateWIB();
  if (!isBusinessWeekdayWIBDate(targetDate)) {
    throw new Error('Pembiasaan hanya aktif pada hari Senin sampai Jumat.');
  }
};

const assertExecutiveForPembiasaanOrThrow = () => {
  const session = getSessionOrThrow();
  const role = toRole(session.role);
  if (!['kepsek', 'kesiswaan', 'kaprog', 'kurikulum', 'admin'].includes(role)) {
    throw new Error('Akses laporan pembiasaan ditolak untuk role ini.');
  }
  return session;
};

const resolveExecutiveScope = async () => {
  const session = assertExecutiveForPembiasaanOrThrow();
  const role = toRole(session.role);
  if (!isJurusanScopedExecutiveReportRole(role)) {
    return { role, jurusanId: null, isJurusanScoped: false };
  }

  let jurusanId = Number.parseInt(session.jurusan_id, 10);
  if (!Number.isInteger(jurusanId) || jurusanId <= 0) {
    const actorId = session.walikelas_id || session.id;
    const { data, error } = await supabase.from('walikelas').select('jurusan_id').eq('id', actorId).maybeSingle();
    if (error) throw error;
    jurusanId = Number.parseInt(data?.jurusan_id, 10);
  }

  if (!Number.isInteger(jurusanId) || jurusanId <= 0) {
    throw new Error('Scope jurusan kaprog tidak valid.');
  }

  return { role, jurusanId, isJurusanScoped: true };
};

export const fetchPembiasaanSettings = async () => {
  const { data, error } = await supabase.from('pembiasaan_settings').select('*').eq('id', 1).maybeSingle();
  if (error) throw error;
  return data;
};

export const savePembiasaanSettings = async ({
  school_name,
  school_lat,
  school_lng,
  radius_meter,
  cutoff_sapa_pagi,
  cutoff_pembiasaan,
  photo_retention_days,
} = {}) => {
  const session = getSessionOrThrow();
  if (toRole(session.role) !== 'admin') {
    throw new Error('Hanya admin yang dapat mengubah pengaturan pembiasaan.');
  }

  const payload = {
    id: 1,
    school_name: String(school_name || 'SMK').trim() || 'SMK',
    school_lat: Number(school_lat),
    school_lng: Number(school_lng),
    radius_meter: Number.parseInt(radius_meter, 10),
    cutoff_sapa_pagi: cutoff_sapa_pagi || '06:30:00',
    cutoff_pembiasaan: cutoff_pembiasaan || '07:00:00',
    photo_retention_days: Number.parseInt(photo_retention_days, 10) || 30,
    updated_by: session.walikelas_id || session.id,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from('pembiasaan_settings').upsert(payload, { onConflict: 'id' }).select('*').single();
  if (error) throw error;
  return data;
};

export const fetchSapaPagiScheduleByDay = async ({ hari } = {}) => {
  const targetDay = normalizeHari(hari);
  const { data, error } = await supabase
    .from('sapa_pagi_schedule')
    .select('id, hari, user_id, is_active, walikelas:user_id(id, nama_lengkap, role, jurusan_id)')
    .eq('hari', targetDay)
    .eq('is_active', true)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
};

export const fetchSapaPagiWeeklySchedule = async () => {
  const allowedDays = WEEKDAY_OPTIONS.map((item) => item.value);
  const { data, error } = await supabase
    .from('sapa_pagi_schedule')
    .select('id, hari, user_id, is_active, walikelas:user_id(id, nama_lengkap, role, jurusan_id)')
    .in('hari', allowedDays)
    .eq('is_active', true)
    .order('hari', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;

  const grouped = allowedDays.reduce((acc, day) => {
    acc[day] = [];
    return acc;
  }, {});

  (data || []).forEach((row) => {
    const day = String(row.hari || '').toLowerCase();
    if (!grouped[day]) return;
    grouped[day].push(row);
  });

  return grouped;
};

export const saveSapaPagiScheduleByDay = async ({ hari, userIds = [] } = {}) => {
  const session = getSessionOrThrow();
  if (toRole(session.role) !== 'admin') {
    throw new Error('Hanya admin yang dapat mengatur jadwal sapa pagi.');
  }

  const targetDay = normalizeHari(hari);
  const normalizedIds = [...new Set((userIds || []).map((id) => String(id || '').trim()).filter(Boolean))];

  const { error: deleteError } = await supabase.from('sapa_pagi_schedule').delete().eq('hari', targetDay);
  if (deleteError) throw deleteError;

  if (normalizedIds.length === 0) return { saved: 0 };

  const payload = normalizedIds.map((id) => ({
    hari: targetDay,
    tanggal: getNextDateForDay(targetDay),
    user_id: id,
    is_active: true,
    created_by: session.walikelas_id || session.id,
  }));

  const { error } = await supabase.from('sapa_pagi_schedule').insert(payload);
  if (error) throw error;
  return { saved: payload.length };
};

export const fetchPembiasaanParticipantOptions = async () => {
  const { data, error } = await supabase
    .from('walikelas')
    .select('id, nama_lengkap, role, jurusan_id')
    .in('role', ['guru', 'tu', 'walikelas', 'walas', 'piket', 'kepsek', 'kesiswaan', 'kaprog', 'kurikulum'])
    .order('nama_lengkap', { ascending: true });
  if (error) throw error;
  return data || [];
};

export const checkMySapaPagiAssignment = async ({ tanggal } = {}) => {
  const session = getSessionOrThrow();
  const targetDay = normalizeHari(getWeekdayFromDateWIB(tanggal));
  const actorId = session.walikelas_id || session.id;
  const { data, error } = await supabase
    .from('sapa_pagi_schedule')
    .select('id, hari, is_active')
    .eq('hari', targetDay)
    .eq('user_id', actorId)
    .eq('is_active', true)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data?.id);
};

const resolveLocation = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Browser tidak mendukung geolocation.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => {
        if (err?.code === 1) {
          reject(new Error('Izin lokasi ditolak. Aktifkan izin lokasi browser lalu coba lagi.'));
          return;
        }
        if (err?.code === 2) {
          reject(new Error('Lokasi tidak tersedia. Pastikan GPS aktif dan sinyal memadai.'));
          return;
        }
        reject(new Error('Lokasi gagal diakses. Aktifkan GPS lalu coba lagi.'));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  });

const resolveLocationWithRetry = async () => {
  try {
    return await resolveLocation();
  } catch (firstError) {
    await new Promise((resolve) => setTimeout(resolve, 650));
    try {
      return await resolveLocation();
    } catch {
      throw firstError;
    }
  }
};

const captureFromCamera = async ({ preferRear = true } = {}) => {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Kamera tidak didukung pada browser ini.');
  }

  const constraintsPrimary = {
    video: {
      facingMode: preferRear ? { ideal: 'environment' } : { ideal: 'user' },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: false,
  };
  const constraintsFallback = {
    video: { width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  };

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia(constraintsPrimary);
  } catch (error) {
    if (error?.name === 'NotAllowedError') {
      throw new Error('Izin kamera ditolak. Aktifkan izin kamera browser lalu coba lagi.');
    }
    if (error?.name === 'NotFoundError') {
      throw new Error('Kamera tidak ditemukan di perangkat ini.');
    }
    stream = await navigator.mediaDevices.getUserMedia(constraintsFallback);
  }

  try {
    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.srcObject = stream;
    await video.play();

    await new Promise((resolve) => setTimeout(resolve, 600));

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.78));
    if (!blob) throw new Error('Gagal mengambil foto dari kamera.');

    return new File([blob], `pembiasaan-${Date.now()}.jpg`, { type: 'image/jpeg' });
  } finally {
    stream.getTracks().forEach((track) => track.stop());
  }
};

const uploadPembiasaanPhoto = async ({ file, activityType, userId }) => {
  const folder = 'pembiasaan';
  const ext = (String(file.name || '').split('.').pop() || 'jpg').toLowerCase();
  const filename = `${folder}/${activityType}/${getTodayDateWIB()}/${userId}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('bukti-absen').upload(filename, file, {
    cacheControl: '3600',
    contentType: file.type || 'image/jpeg',
    upsert: false,
  });
  if (error) throw error;
  return filename;
};

const toMinutes = (hhmmss = '00:00:00') => {
  const [h = '0', m = '0'] = String(hhmmss).split(':');
  return Number.parseInt(h, 10) * 60 + Number.parseInt(m, 10);
};

const getWibNowMinutes = () => {
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
  return Number.parseInt(map.hour || '0', 10) * 60 + Number.parseInt(map.minute || '0', 10);
};

const distanceMeters = (lat1, lng1, lat2, lng2) => {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
};

const submitViaDirectInsert = async ({ activityType, status, note, location, filePath, fileSize, evidenceSource }) => {
  const session = getSessionOrThrow();
  const actorId = session.walikelas_id || session.id;
  const actorRole = toRole(session.role);
  const actorJurusan = Number.parseInt(session.jurusan_id, 10);
  const targetDate = getTodayDateWIB();
  const settings = await fetchPembiasaanSettings();
  if (!settings) throw new Error('Pengaturan pembiasaan belum tersedia.');

  assertBusinessWeekdayOrThrow(targetDate);

  const policy = getEvidencePolicyByStatus(status);
  const normalizedNote = String(note || '').trim();

  if (policy.requireNote && !normalizedNote) {
    throw new Error('Catatan wajib diisi untuk status izin/sakit.');
  }
  if (!policy.requireNote && normalizedNote) {
    throw new Error('Catatan untuk status hadir harus kosong.');
  }

  const nowMinutes = getWibNowMinutes();
  if (activityType === ACTIVITY_TYPES.SAPA) {
    const assigned = await checkMySapaPagiAssignment({});
    if (!assigned) throw new Error('Tidak ada jadwal sapa pagi untuk Anda.');
    if (nowMinutes > toMinutes(settings.cutoff_sapa_pagi || '06:30:00')) {
      throw new Error('Waktu submit sapa pagi sudah melewati cutoff.');
    }
  }

  if (activityType === ACTIVITY_TYPES.PEMBIASAAN && nowMinutes > toMinutes(settings.cutoff_pembiasaan || '07:00:00')) {
    throw new Error('Waktu submit pembiasaan sudah melewati cutoff.');
  }

  let dist = null;
  let isWithinRadius = null;

  if (policy.requireLocation) {
    if (!location || !Number.isFinite(Number(location.lat)) || !Number.isFinite(Number(location.lng))) {
      throw new Error('GPS wajib aktif untuk status hadir.');
    }
    if (!String(filePath || '').trim()) {
      throw new Error('Foto bukti wajib diisi untuk status hadir.');
    }

    dist = distanceMeters(
      Number(settings.school_lat),
      Number(settings.school_lng),
      Number(location.lat),
      Number(location.lng),
    );
    const radius = Number(settings.radius_meter || 200);
    if (dist > radius) {
      throw new Error(`Lokasi di luar radius sekolah (${radius} meter).`);
    }
    isWithinRadius = true;
  }

  const payload = {
    tanggal: targetDate,
    activity_type: activityType,
    user_id: actorId,
    role_snapshot: actorRole,
    jurusan_id_snapshot: Number.isInteger(actorJurusan) ? actorJurusan : null,
    status,
    checkin_at: new Date().toISOString(),
    note: policy.requireNote ? normalizedNote : null,
    photo_path: policy.requirePhoto ? filePath : null,
    photo_size_kb: policy.requirePhoto ? Math.max(1, Math.round((fileSize || 0) / 1024)) : null,
    lat: policy.requireLocation ? Number(location.lat) : null,
    lng: policy.requireLocation ? Number(location.lng) : null,
    distance_meter: dist,
    is_within_radius: isWithinRadius,
    evidence_source: policy.requirePhoto ? evidenceSource : null,
    created_by_system: false,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('pembiasaan_attendance')
    .upsert(payload, { onConflict: 'tanggal,activity_type,user_id' })
    .select('*')
    .single();
  if (error) throw error;

  return {
    success: true,
    activity: activityType,
    tanggal: targetDate,
    status,
    distance_meter: dist,
    is_within_radius: isWithinRadius,
    id: data?.id,
  };
};

const submitViaRpc = async ({ rpcName, status, note, activityType, preferRearCamera }) => {
  const session = getSessionOrThrow();
  const actorId = session.walikelas_id || session.id;
  const targetDate = getTodayDateWIB();
  assertBusinessWeekdayOrThrow(targetDate);

  const policy = getEvidencePolicyByStatus(status);
  let location = null;
  let file = null;
  let filePath = null;
  let evidenceSource = null;

  if (policy.requireLocation || policy.requirePhoto) {
    [location, file] = await Promise.all([
      resolveLocationWithRetry(),
      captureFromCamera({ preferRear: preferRearCamera }),
    ]);
    filePath = await uploadPembiasaanPhoto({ file, activityType, userId: actorId });
    evidenceSource = preferRearCamera ? 'rear_camera' : 'front_camera';
  }

  const { data, error } = await supabase.rpc(rpcName, {
    p_status: status,
    p_note: note || null,
    p_lat: location?.lat ?? null,
    p_lng: location?.lng ?? null,
    p_photo_path: filePath,
    p_photo_size_kb: file ? Math.max(1, Math.round(file.size / 1024)) : null,
    p_evidence_source: evidenceSource,
  });
  if (error) {
    const message = String(error.message || '').toLowerCase();
    if (
      message.includes('user tidak valid') ||
      message.includes('permission denied') ||
      message.includes('row-level security')
    ) {
      return submitViaDirectInsert({
        activityType,
        status,
        note,
        location,
        filePath,
        fileSize: file?.size,
        evidenceSource,
      });
    }
    throw error;
  }
  return data;
};

export const submitSapaPagiAttendance = async ({ status, note }) =>
  submitViaRpc({
    rpcName: 'fn_submit_sapa_pagi',
    status,
    note,
    activityType: ACTIVITY_TYPES.SAPA,
    preferRearCamera: true,
  });

export const submitPembiasaanAttendance = async ({ status, note }) =>
  submitViaRpc({
    rpcName: 'fn_submit_pembiasaan',
    status,
    note,
    activityType: ACTIVITY_TYPES.PEMBIASAAN,
    preferRearCamera: true,
  });

export const finalizePembiasaanAutoAlpha = async ({ tanggal } = {}) => {
  const { data, error } = await supabase.rpc('fn_finalize_auto_alpha', { p_tanggal: tanggal || getTodayDateWIB() });
  if (error) throw error;
  return data;
};

export const fetchMyPembiasaanDashboard = async ({ tanggal } = {}) => {
  const session = getSessionOrThrow();
  const actorId = session.walikelas_id || session.id;
  const targetDate = tanggal || getTodayDateWIB();
  const now = new Date(`${targetDate}T00:00:00+07:00`);
  const year = now.getFullYear();
  const month = now.getMonth();
  const fromDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const toDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(new Date(year, month + 1, 0).getDate()).padStart(2, '0')}`;

  const { data, error } = await supabase
    .from('pembiasaan_attendance')
    .select('activity_type, status, tanggal')
    .eq('user_id', actorId)
    .gte('tanggal', fromDate)
    .lte('tanggal', toDate);
  if (error) throw error;

  const rows = data || [];
  const sum = {
    sapa: { ikut: 0, alpha: 0 },
    pembiasaan: { ikut: 0, alpha: 0 },
  };
  rows.forEach((row) => {
    const activity = row.activity_type === ACTIVITY_TYPES.SAPA ? 'sapa' : 'pembiasaan';
    if (row.status === 'alpha') {
      sum[activity].alpha += 1;
    } else {
      sum[activity].ikut += 1;
    }
  });

  return {
    month: `${year}-${String(month + 1).padStart(2, '0')}`,
    ...sum,
  };
};

export const fetchExecutivePembiasaanReport = async ({ fromDate, toDate, activityType, status, userId } = {}) => {
  const scope = await resolveExecutiveScope();
  await finalizePembiasaanAutoAlpha({ tanggal: toDate || getTodayDateWIB() });

  let query = supabase
    .from('vw_riwayat_pembiasaan_detail')
    .select('*')
    .order('tanggal', { ascending: false })
    .order('created_at', { ascending: false });

  if (fromDate) query = query.gte('tanggal', fromDate);
  if (toDate) query = query.lte('tanggal', toDate);
  if (activityType && activityType !== 'all') query = query.eq('activity_type', activityType);
  if (userId && userId !== 'all') query = query.eq('user_id', userId);
  if (scope.isJurusanScoped) query = query.eq('jurusan_id_snapshot', scope.jurusanId);

  const { data, error } = await query;
  if (error) throw error;

  const allRows = data || [];
  const rows = allRows.filter((row) => !isExcludedExecutiveRole(row.role || row.role_snapshot));

  const [{ data: participantsData, error: participantsError }, { data: holidaysData, error: holidaysError }] = await Promise.all([
    fetchPembiasaanParticipantOptions().then((list) => ({ data: list, error: null })).catch((err) => ({ data: [], error: err })),
    supabase
      .from('school_calendar')
      .select('tanggal, is_libur')
      .gte('tanggal', fromDate || getTodayDateWIB())
      .lte('tanggal', toDate || getTodayDateWIB()),
  ]);

  if (participantsError) throw participantsError;
  if (holidaysError) throw holidaysError;

  let participants = (participantsData || []).filter((row) => !isExcludedExecutiveRole(row.role));
  if (scope.isJurusanScoped) {
    participants = participants.filter((row) => Number.parseInt(row.jurusan_id, 10) === scope.jurusanId);
  }

  const holidaySet = new Set((holidaysData || []).filter((item) => item?.is_libur).map((item) => normalizeDate(item.tanggal)));
  const dateList = enumerateDateRange(fromDate || getTodayDateWIB(), toDate || getTodayDateWIB());
  const activeSchoolDates = dateList.filter((item) => isBusinessWeekdayWIBDate(item) && !holidaySet.has(item));

  const obligationsByUserId = {};
  participants.forEach((row) => {
    obligationsByUserId[String(row.id)] = 0;
  });

  const includePembiasaan = !activityType || activityType === 'all' || activityType === ACTIVITY_TYPES.PEMBIASAAN;
  const includeSapa = !activityType || activityType === 'all' || activityType === ACTIVITY_TYPES.SAPA;

  if (includePembiasaan) {
    const pembiasaanObligation = activeSchoolDates.length;
    Object.keys(obligationsByUserId).forEach((id) => {
      obligationsByUserId[id] += pembiasaanObligation;
    });
  }

  if (includeSapa) {
    let sapaScheduleQuery = supabase
      .from('sapa_pagi_schedule')
      .select('hari, user_id, walikelas:user_id(id, jurusan_id)')
      .eq('is_active', true)
      .in('hari', WEEKDAY_OPTIONS.map((item) => item.value));

    if (scope.isJurusanScoped) {
      sapaScheduleQuery = sapaScheduleQuery.eq('walikelas.jurusan_id', scope.jurusanId);
    }

    const { data: sapaScheduleRows, error: sapaScheduleError } = await sapaScheduleQuery;
    if (sapaScheduleError) throw sapaScheduleError;

    const userByDay = WEEKDAY_OPTIONS.reduce((acc, item) => {
      acc[item.value] = new Set();
      return acc;
    }, {});

    (sapaScheduleRows || []).forEach((row) => {
      const day = normalizeHari(row.hari);
      const uid = String(row.user_id || '');
      if (!uid || !userByDay[day]) return;
      userByDay[day].add(uid);
    });

    activeSchoolDates.forEach((dateValue) => {
      const dayName = getWeekdayFromDateWIB(dateValue);
      const users = userByDay[dayName] || new Set();
      users.forEach((uid) => {
        obligationsByUserId[uid] = Number(obligationsByUserId[uid] || 0) + 1;
      });
    });
  }

  const recapRows = buildTeacherRecapRows({ rows, participants, obligationsByUserId });

  const monitoringRows = rows.filter((row) => {
    if (!status || status === 'all') return true;
    return String(row.status || '').toLowerCase() === String(status).toLowerCase();
  });

  const summary = rows.reduce(
    (acc, row) => {
      acc.total += 1;
      if (row.activity_type === ACTIVITY_TYPES.SAPA) acc.sapa += 1;
      if (row.activity_type === ACTIVITY_TYPES.PEMBIASAAN) acc.pembiasaan += 1;
      if (row.status === 'hadir') acc.hadir += 1;
      if (row.status === 'izin') acc.izin += 1;
      if (row.status === 'sakit') acc.sakit += 1;
      if (row.status === 'alpha') acc.alpha += 1;
      return acc;
    },
    { total: 0, sapa: 0, pembiasaan: 0, hadir: 0, izin: 0, sakit: 0, alpha: 0 },
  );

  return {
    summary,
    rows,
    monitoringRows,
    recapRows,
    scope: scope.isJurusanScoped ? 'jurusan' : 'global',
    activeDaysCount: activeSchoolDates.length,
    excludedHolidayCount: holidaySet.size,
  };
};
