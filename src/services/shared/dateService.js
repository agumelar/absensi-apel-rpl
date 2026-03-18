export const getTodayDateWIB = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

export const formatDateToWIB = (dateValue) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(dateValue));

export const getDateDaysAgoWIB = (daysAgo) => {
  const safeDays = Number.isFinite(daysAgo) ? Math.max(0, Math.floor(daysAgo)) : 0;
  const now = new Date();
  now.setDate(now.getDate() - safeDays);
  return formatDateToWIB(now);
};
