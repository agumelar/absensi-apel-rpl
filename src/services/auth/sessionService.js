import { normalizeBooleanFlag, normalizeRole } from '../../shared/constants/roles';

const SESSION_STORAGE_KEY = 'jingga_session_v2';
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;
const SESSION_VERSION = 2;

const toSafeString = (value) => (value === undefined || value === null ? '' : String(value));
const nowMs = () => Date.now();

const isSessionExpired = (session) => Number(session?.expires_at || 0) <= nowMs();

export const createSessionPayload = (userData) => {
  const walikelasId = userData?.walikelas_id ?? userData?.id ?? '';
  const role = normalizeRole(userData?.role);
  const isGuruMapel = normalizeBooleanFlag(userData?.is_guru_mapel);
  const issuedAt = Number(userData?.issued_at) || nowMs();
  const expiresAt = Number(userData?.expires_at) || issuedAt + SESSION_TTL_MS;

  return {
    id: walikelasId,
    walikelas_id: walikelasId,
    role,
    is_guru_mapel: isGuruMapel,
    nama_lengkap: userData?.nama_lengkap ?? '',
    username: userData?.username ?? '',
    kelas_id: userData?.kelas_id ?? null,
    jurusan_id: userData?.jurusan_id ?? null,
    issued_at: issuedAt,
    expires_at: expiresAt,
    session_version: SESSION_VERSION,
  };
};

const writeSession = (payload) => {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(payload));
};

const rotateSession = (session) => {
  const nextPayload = createSessionPayload({
    ...session,
    issued_at: session?.issued_at || nowMs(),
    expires_at: nowMs() + SESSION_TTL_MS,
  });
  writeSession(nextPayload);
  return nextPayload;
};

export const persistSession = (userData) => {
  const payload = createSessionPayload(userData);
  writeSession(payload);
  return payload;
};

export const readSession = () => {
  const raw = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    const normalized = createSessionPayload(parsed);
    if (normalized.session_version !== SESSION_VERSION || isSessionExpired(normalized)) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    return normalized;
  } catch {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
};

export const clearSession = () => {
  localStorage.removeItem(SESSION_STORAGE_KEY);
};

export const hasValidSession = () => {
  const session = readSession();
  if (!session?.walikelas_id || !session?.role) return false;
  rotateSession(session);
  return true;
};

export const getSessionOrThrow = () => {
  const session = readSession();
  if (!session?.walikelas_id || !session?.role) {
    throw new Error('Sesi login tidak valid. Silakan login ulang.');
  }

  return rotateSession(session);
};

export const assertMapelAccessOrThrow = () => {
  const session = getSessionOrThrow();
  if (!session.is_guru_mapel && session.role !== 'guru' && session.role !== 'guru_mapel') {
    throw new Error('Akses mapel ditolak untuk akun ini.');
  }

  return session;
};

export const assertGuruOwnershipOrThrow = (guruId) => {
  const session = assertMapelAccessOrThrow();
  const requested = toSafeString(guruId);
  const owner = toSafeString(session.walikelas_id);

  if (requested && owner && requested !== owner) {
    throw new Error('Akses data guru lain ditolak.');
  }

  return session;
};
