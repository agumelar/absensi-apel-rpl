const toSafeNumber = (value, fallback = 0) => {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : fallback;
};

const toSafeRatio = (value) => {
  const normalized = toSafeNumber(value, 0);
  return Math.max(0, Math.min(1, normalized));
};

export const getAttendanceProgressState = ({ filled = 0, total = 0, doneThreshold = 0.9 } = {}) => {
  const safeTotal = Math.max(0, Math.floor(toSafeNumber(total, 0)));
  const safeFilled = Math.max(0, Math.floor(toSafeNumber(filled, 0)));

  if (safeTotal === 0) {
    return {
      ratio: 0,
      status: 'not_started',
      isDone: false,
    };
  }

  const ratio = Math.min(1, safeFilled / safeTotal);
  const threshold = toSafeRatio(doneThreshold);

  if (ratio === 0) {
    return { ratio, status: 'not_started', isDone: false };
  }

  if (ratio >= threshold) {
    return { ratio, status: 'completed', isDone: true };
  }

  return { ratio, status: 'in_progress', isDone: false };
};

export const canCheckOutSession = ({
  hasSchedule,
  hasSession,
  hasCheckIn,
  hasAgendaSubmitted,
  attendanceCompletionRatio,
  minAttendanceRatio = 1,
} = {}) => {
  if (!hasSchedule) return { allowed: false, reason: 'schedule_required' };
  if (!hasSession) return { allowed: false, reason: 'session_required' };
  if (!hasCheckIn) return { allowed: false, reason: 'check_in_required' };
  if (!hasAgendaSubmitted) return { allowed: false, reason: 'agenda_required' };

  const currentRatio = toSafeRatio(attendanceCompletionRatio);
  const requiredRatio = toSafeRatio(minAttendanceRatio);
  if (currentRatio < requiredRatio) return { allowed: false, reason: 'attendance_not_ready' };

  return { allowed: true, reason: null };
};

export const getPhotoActionLabel = ({ hasPhoto, defaultLabel }) =>
  (hasPhoto ? 'Lihat Foto' : defaultLabel);
