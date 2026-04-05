const NOTE_REQUIRED_STATUSES = new Set(['izin', 'sakit']);
const LOCATION_REQUIRED_STATUSES = new Set(['hadir']);
const PHOTO_REQUIRED_STATUSES = new Set(['hadir']);

const normalizeStatus = (status) => String(status || '').trim().toLowerCase();

export const getEvidencePolicyByStatus = (status) => {
  const normalized = normalizeStatus(status);
  return {
    requireLocation: LOCATION_REQUIRED_STATUSES.has(normalized),
    requirePhoto: PHOTO_REQUIRED_STATUSES.has(normalized),
    requireNote: NOTE_REQUIRED_STATUSES.has(normalized),
  };
};

export const shouldValidateSchoolRadius = (status) => getEvidencePolicyByStatus(status).requireLocation;

export const isBusinessWeekdayWIBDate = (dateValue) => {
  if (!dateValue) return true;
  const parsed = new Date(`${dateValue}T12:00:00+07:00`);
  if (Number.isNaN(parsed.getTime())) return true;
  const isoDay = ((parsed.getUTCDay() + 6) % 7) + 1;
  return isoDay >= 1 && isoDay <= 5;
};
