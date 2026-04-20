const pad2 = (value) => String(value).padStart(2, '0');

const WIB_TIME_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Jakarta',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export const normalizeAttendanceTimeInput = (rawValue) => {
  const raw = String(rawValue ?? '').trim();
  if (!raw) return null;

  const normalizedSeparator = raw.replace('.', ':');
  const match = normalizedSeparator.match(/^(\d{1,2}):(\d{1,2})(?::\d{1,2})?$/);
  if (!match) return null;

  const hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);

  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23) return null;
  if (minute < 0 || minute > 59) return null;

  return `${pad2(hour)}:${pad2(minute)}`;
};

export const toAttendanceTimeForDb = (rawValue) => {
  const hhmm = normalizeAttendanceTimeInput(rawValue);
  if (!hhmm) return null;
  return `${hhmm}:00`;
};

export const formatAttendanceTimeHHMM = (rawValue) => normalizeAttendanceTimeInput(rawValue);

export const getCurrentTimeHHMMWIB = (dateValue = new Date(), options = {}) => {
  const fallback = normalizeAttendanceTimeInput(options?.fallback ?? '') || null;
  const sourceDate = dateValue === null || dateValue === undefined
    ? (options?.now ?? new Date())
    : dateValue;
  const date = new Date(sourceDate);
  if (Number.isNaN(date.getTime())) return fallback;
  return WIB_TIME_FORMATTER.format(date);
};
