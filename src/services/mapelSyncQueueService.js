import {
  fetchDailyScoreBySession,
  fetchStudentAttendanceBySession,
  upsertBulkStudentAttendanceMapel,
  upsertDailyScore,
} from './mapelService';

const MAPEL_SYNC_QUEUE_STORAGE_KEY = 'mapel_sync_queue_v1';
const MAPEL_SYNC_MAX_ITEMS = 1000;
const MAPEL_SYNC_TYPE = {
  ATTENDANCE: 'attendance',
  SCORE: 'score',
};

const isClientOnline = () => navigator.onLine !== false;

const normalizeAttendanceCode = (status) => {
  const normalized = String(status || '').trim().toUpperCase();
  if (normalized === 'H' || normalized === 'HADIR') return 'H';
  if (normalized === 'S' || normalized === 'SAKIT') return 'S';
  if (normalized === 'I' || normalized === 'IZIN') return 'I';
  if (normalized === 'A' || normalized === 'ALPHA') return 'A';
  throw new Error(`Status absensi mapel tidak valid: ${status}`);
};

const normalizeAttendanceCodeFromServer = (status) => {
  const normalized = String(status || '').trim().toUpperCase();
  if (normalized === 'H' || normalized === 'HADIR') return 'H';
  if (normalized === 'S' || normalized === 'SAKIT') return 'S';
  if (normalized === 'I' || normalized === 'IZIN') return 'I';
  if (normalized === 'A' || normalized === 'ALPHA') return 'A';
  return null;
};

const normalizeScoreValue = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return null;
  return parsed;
};

const normalizeScoreText = (value) => String(value ?? '').trim();

const makeAttendanceQueueId = ({ sessionId, siswaId }) => `attendance:${sessionId}:${siswaId}`;
const makeScoreQueueId = ({ sessionId, siswaId }) => `score:${sessionId}:${siswaId}`;

const readQueue = () => {
  const raw = localStorage.getItem(MAPEL_SYNC_QUEUE_STORAGE_KEY);
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error('Format queue sinkronisasi mapel tidak valid.');
  }
  return parsed;
};

const writeQueue = (items) => {
  localStorage.setItem(MAPEL_SYNC_QUEUE_STORAGE_KEY, JSON.stringify(items));
};

const upsertQueueItems = (newItems) => {
  const existing = readQueue();
  const map = new Map(existing.map((item) => [item.id, item]));
  newItems.forEach((item) => {
    const previous = map.get(item.id);
    map.set(item.id, {
      ...previous,
      ...item,
      retry_count: previous?.retry_count || 0,
      last_error: null,
      updated_at: new Date().toISOString(),
    });
  });

  const next = [...map.values()]
    .sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime())
    .slice(-MAPEL_SYNC_MAX_ITEMS);
  writeQueue(next);
  return next;
};

const applySyncResultToQueue = ({ syncedIds, failedIdsWithError }) => {
  const current = readQueue();
  const syncedSet = new Set(syncedIds);
  const failedMap = new Map(failedIdsWithError.map((item) => [item.id, item.error]));
  const next = current
    .filter((item) => !syncedSet.has(item.id))
    .map((item) => {
      if (!failedMap.has(item.id)) return item;
      return {
        ...item,
        retry_count: Number(item.retry_count || 0) + 1,
        last_error: failedMap.get(item.id),
        last_attempt_at: new Date().toISOString(),
      };
    });
  writeQueue(next);
  return next;
};

export const isLikelyNetworkError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('load failed') ||
    message.includes('network request failed') ||
    message.includes('fetch')
  );
};

export const getMapelSyncQueueSummary = () => {
  const queue = readQueue();
  const summary = queue.reduce(
    (acc, item) => {
      acc.total += 1;
      if (item.type === MAPEL_SYNC_TYPE.ATTENDANCE) acc.attendance += 1;
      if (item.type === MAPEL_SYNC_TYPE.SCORE) acc.score += 1;
      return acc;
    },
    { total: 0, attendance: 0, score: 0 },
  );
  return summary;
};

const queueAttendanceEntries = ({ sessionId, entries, actorName, source = 'manual_click', baseMap = {} }) => {
  const queueItems = entries.map((entry) => ({
    id: makeAttendanceQueueId({ sessionId, siswaId: entry.siswaId }),
    type: MAPEL_SYNC_TYPE.ATTENDANCE,
    session_id: String(sessionId),
    siswa_id: String(entry.siswaId),
    status: normalizeAttendanceCode(entry.status),
    base_status: baseMap?.[entry.siswaId] ?? null,
    actor_name: actorName ?? null,
    source,
    updated_at: new Date().toISOString(),
  }));
  const next = upsertQueueItems(queueItems);
  return { queuedCount: queueItems.length, pendingCount: next.length };
};

const queueScoreEntries = ({ entries, baseMap = {} }) => {
  const queueItems = entries.map((entry) => ({
    id: makeScoreQueueId({ sessionId: entry.sessionId, siswaId: entry.siswaId }),
    type: MAPEL_SYNC_TYPE.SCORE,
    session_id: String(entry.sessionId),
    siswa_id: String(entry.siswaId),
    nilai: normalizeScoreValue(entry.nilai),
    catatan: normalizeScoreText(entry.catatan),
    base_nilai: normalizeScoreValue(baseMap?.[entry.siswaId]?.nilai),
    base_catatan: normalizeScoreText(baseMap?.[entry.siswaId]?.catatan),
    updated_at: new Date().toISOString(),
  }));
  const next = upsertQueueItems(queueItems);
  return { queuedCount: queueItems.length, pendingCount: next.length };
};

export const saveAttendanceWithOfflineFallback = async ({
  sessionId,
  entries,
  actorName,
  source = 'manual_click',
  baseMap = {},
}) => {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('entries absensi mapel tidak boleh kosong');
  }
  const normalizedEntries = entries.map((entry) => ({
    sessionId,
    siswaId: entry.siswaId,
    status: normalizeAttendanceCode(entry.status),
  }));

  if (isClientOnline()) {
    try {
      await upsertBulkStudentAttendanceMapel(normalizedEntries, {
        source,
        actorName,
      });
      return { mode: 'synced', syncedCount: normalizedEntries.length, queuedCount: 0 };
    } catch (error) {
      if (!isLikelyNetworkError(error)) {
        throw error;
      }
    }
  }

  const queued = queueAttendanceEntries({
    sessionId,
    entries: normalizedEntries,
    actorName,
    source,
    baseMap,
  });
  return { mode: 'queued', syncedCount: 0, ...queued };
};

export const saveDailyScoreWithOfflineFallback = async ({
  sessionId,
  siswaId,
  nilai,
  catatan,
  base = {},
}) => {
  const payload = {
    sessionId,
    siswaId,
    nilai: normalizeScoreValue(nilai),
    catatan: normalizeScoreText(catatan) || null,
  };

  if (isClientOnline()) {
    try {
      await upsertDailyScore(payload);
      return { mode: 'synced', syncedCount: 1, queuedCount: 0 };
    } catch (error) {
      if (!isLikelyNetworkError(error)) {
        throw error;
      }
    }
  }

  const queued = queueScoreEntries({
    entries: [{ ...payload, catatan: payload.catatan || '' }],
    baseMap: { [siswaId]: base },
  });
  return { mode: 'queued', syncedCount: 0, ...queued };
};

export const saveBulkDailyScoreWithOfflineFallback = async ({ entries, baseMap = {} }) => {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('entries nilai harian tidak boleh kosong');
  }
  const normalizedEntries = entries.map((entry) => ({
    sessionId: entry.sessionId,
    siswaId: entry.siswaId,
    nilai: normalizeScoreValue(entry.nilai),
    catatan: normalizeScoreText(entry.catatan) || null,
  }));

  if (isClientOnline()) {
    try {
      await Promise.all(normalizedEntries.map((entry) => upsertDailyScore(entry)));
      return { mode: 'synced', syncedCount: normalizedEntries.length, queuedCount: 0 };
    } catch (error) {
      if (!isLikelyNetworkError(error)) {
        throw error;
      }
    }
  }

  const queued = queueScoreEntries({ entries: normalizedEntries, baseMap });
  return { mode: 'queued', syncedCount: 0, ...queued };
};

const flushAttendanceGroup = async (items) => {
  const sessionId = items[0].session_id;
  const serverRows = await fetchStudentAttendanceBySession(sessionId);
  const serverMap = new Map(
    (serverRows || []).map((row) => [String(row.siswa_id), normalizeAttendanceCodeFromServer(row.status)]),
  );

  const conflictCount = items.reduce((acc, item) => {
    const serverStatus = serverMap.get(String(item.siswa_id));
    const baseStatus = item.base_status ? normalizeAttendanceCode(item.base_status) : null;
    const localStatus = normalizeAttendanceCode(item.status);
    if (!serverStatus || serverStatus === localStatus) return acc;
    if (baseStatus && serverStatus === baseStatus) return acc;
    return acc + 1;
  }, 0);

  const payload = items.map((item) => ({
    sessionId,
    siswaId: item.siswa_id,
    status: normalizeAttendanceCode(item.status),
  }));

  await upsertBulkStudentAttendanceMapel(payload, {
    source: 'offline_queue',
    actorName: items[items.length - 1].actor_name || null,
  });

  return {
    syncedCount: payload.length,
    conflictCount,
    syncedIds: items.map((item) => item.id),
  };
};

const flushScoreGroup = async (items) => {
  const sessionId = items[0].session_id;
  const serverRows = await fetchDailyScoreBySession(sessionId);
  const serverMap = new Map(
    (serverRows || []).map((row) => [
      String(row.siswa_id),
      {
        nilai: normalizeScoreValue(row.nilai),
        catatan: normalizeScoreText(row.catatan),
      },
    ]),
  );

  const conflictCount = items.reduce((acc, item) => {
    const server = serverMap.get(String(item.siswa_id));
    if (!server) return acc;
    const local = {
      nilai: normalizeScoreValue(item.nilai),
      catatan: normalizeScoreText(item.catatan),
    };
    const base = {
      nilai: normalizeScoreValue(item.base_nilai),
      catatan: normalizeScoreText(item.base_catatan),
    };
    const sameAsServer = server.nilai === local.nilai && server.catatan === local.catatan;
    const sameAsBase = server.nilai === base.nilai && server.catatan === base.catatan;
    if (sameAsServer || sameAsBase) return acc;
    return acc + 1;
  }, 0);

  await Promise.all(
    items.map((item) =>
      upsertDailyScore({
        sessionId,
        siswaId: item.siswa_id,
        nilai: normalizeScoreValue(item.nilai),
        catatan: normalizeScoreText(item.catatan) || null,
      }),
    ),
  );

  return {
    syncedCount: items.length,
    conflictCount,
    syncedIds: items.map((item) => item.id),
  };
};

export const flushMapelSyncQueue = async () => {
  const queue = readQueue();
  if (!queue.length) {
    return {
      syncedCount: 0,
      conflictCount: 0,
      failedCount: 0,
      remainingCount: 0,
      skippedOffline: false,
    };
  }

  if (!isClientOnline()) {
    return {
      syncedCount: 0,
      conflictCount: 0,
      failedCount: 0,
      remainingCount: queue.length,
      skippedOffline: true,
    };
  }

  const attendanceGroups = new Map();
  const scoreGroups = new Map();
  queue.forEach((item) => {
    const key = `${item.type}:${item.session_id}`;
    if (item.type === MAPEL_SYNC_TYPE.ATTENDANCE) {
      const current = attendanceGroups.get(key) || [];
      current.push(item);
      attendanceGroups.set(key, current);
    }
    if (item.type === MAPEL_SYNC_TYPE.SCORE) {
      const current = scoreGroups.get(key) || [];
      current.push(item);
      scoreGroups.set(key, current);
    }
  });

  const syncedIds = [];
  const failedIdsWithError = [];
  let syncedCount = 0;
  let conflictCount = 0;

  const processGroup = async (group, flusher) => {
    const result = await flusher(group);
    syncedCount += result.syncedCount;
    conflictCount += result.conflictCount;
    syncedIds.push(...result.syncedIds);
  };

  for (const group of attendanceGroups.values()) {
    try {
      await processGroup(group, flushAttendanceGroup);
    } catch (error) {
      const message = String(error?.message || 'Sinkronisasi absensi gagal.');
      group.forEach((item) => {
        failedIdsWithError.push({ id: item.id, error: message });
      });
      if (isLikelyNetworkError(error)) break;
    }
  }

  for (const group of scoreGroups.values()) {
    try {
      await processGroup(group, flushScoreGroup);
    } catch (error) {
      const message = String(error?.message || 'Sinkronisasi nilai gagal.');
      group.forEach((item) => {
        failedIdsWithError.push({ id: item.id, error: message });
      });
      if (isLikelyNetworkError(error)) break;
    }
  }

  const nextQueue = applySyncResultToQueue({
    syncedIds,
    failedIdsWithError,
  });

  return {
    syncedCount,
    conflictCount,
    failedCount: failedIdsWithError.length,
    remainingCount: nextQueue.length,
    skippedOffline: false,
  };
};
