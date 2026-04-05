const toDateOnly = (value) => String(value || '').trim().slice(0, 10);

export const isBusinessWeekdayWIBDate = (dateValue) => {
  if (!dateValue) return true;
  const parsed = new Date(`${toDateOnly(dateValue)}T12:00:00+07:00`);
  if (Number.isNaN(parsed.getTime())) return true;
  const isoDay = ((parsed.getUTCDay() + 6) % 7) + 1;
  return isoDay >= 1 && isoDay <= 5;
};

export const buildSchoolHolidaySet = (schoolCalendarRows = []) => {
  const set = new Set();
  (schoolCalendarRows || []).forEach((row) => {
    if (!row?.is_libur) return;
    const key = toDateOnly(row.tanggal);
    if (key) set.add(key);
  });
  return set;
};

export const isActiveSchoolDate = (dateValue, holidaySet = new Set()) => {
  const key = toDateOnly(dateValue);
  if (!key) return false;
  if (!isBusinessWeekdayWIBDate(key)) return false;
  return !holidaySet.has(key);
};

export const filterActiveSchoolSessionRows = (sessionRows = [], holidaySet = new Set()) =>
  (sessionRows || []).filter((row) => isActiveSchoolDate(row?.tanggal, holidaySet));
