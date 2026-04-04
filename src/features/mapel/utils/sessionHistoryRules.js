const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const pad2 = (value) => String(value).padStart(2, '0');

const parseIsoDateOrThrow = (dateValue) => {
  const safeValue = String(dateValue || '').trim();
  if (!ISO_DATE_REGEX.test(safeValue)) {
    throw new Error('Tanggal tidak valid.');
  }

  const [yearRaw, monthRaw, dayRaw] = safeValue.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const dt = new Date(Date.UTC(year, month - 1, day));
  const isValid =
    dt.getUTCFullYear() === year && dt.getUTCMonth() + 1 === month && dt.getUTCDate() === day;

  if (!isValid) throw new Error('Tanggal tidak valid.');

  return { year, month, day };
};

export const buildMonthRangeByOffset = (anchorDate, monthOffset = 0) => {
  const { year, month } = parseIsoDateOrThrow(anchorDate);
  const baseMonthIndex = month - 1;
  const target = new Date(Date.UTC(year, baseMonthIndex + monthOffset, 1));

  const targetYear = target.getUTCFullYear();
  const targetMonth = target.getUTCMonth() + 1;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();

  return {
    fromDate: `${targetYear}-${pad2(targetMonth)}-01`,
    toDate: `${targetYear}-${pad2(targetMonth)}-${pad2(lastDay)}`,
  };
};

export const toLocalTimeLabel = (isoDateTime) => {
  if (!isoDateTime) return '-';

  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(date)
    .replace('.', ':');
};

const resolveAgenda = (row) => {
  const agenda = Array.isArray(row?.class_agenda) ? row.class_agenda[0] : row?.class_agenda;
  return {
    topik: agenda?.topik || '-',
    metode: agenda?.metode || '-',
  };
};

const summarizeAttendanceByCode = (attendanceRows) => {
  const safeRows = Array.isArray(attendanceRows) ? attendanceRows : [];

  return safeRows.reduce(
    (acc, item) => {
      const status = String(item?.status || '').trim().toUpperCase();
      if (status === 'H' || status === 'HADIR') acc.H += 1;
      else if (status === 'S' || status === 'SAKIT') acc.S += 1;
      else if (status === 'I' || status === 'IZIN') acc.I += 1;
      else if (status === 'A' || status === 'ALPHA') acc.A += 1;
      return acc;
    },
    { H: 0, S: 0, I: 0, A: 0 },
  );
};

const resolveAbsenceTask = (row) => {
  const task = Array.isArray(row?.teacher_absence_task) ? row.teacher_absence_task[0] : row?.teacher_absence_task;
  return task || null;
};

export const resolveTaskDeliverySummary = (row) => {
  const task = resolveAbsenceTask(row);
  if (!task) {
    return {
      taskId: null,
      deliveredByPicket: false,
      deliveredAtRaw: null,
      deliveryStatusLabel: '-',
      deliveryTimeLabel: '-',
    };
  }

  const deliveredByPicket = Boolean(task.delivered_by_picket);
  const deliveredAtRaw = task.delivered_at || null;

  return {
    taskId: task.id ?? null,
    deliveredByPicket,
    deliveredAtRaw,
    deliveryStatusLabel: deliveredByPicket ? 'Sudah Didistribusikan' : 'Menunggu Distribusi',
    deliveryTimeLabel: deliveredByPicket ? toLocalTimeLabel(deliveredAtRaw) : '-',
  };
};

export const buildSessionHistoryExcelRows = (rows) => {
  const safeRows = Array.isArray(rows) ? rows : [];

  return safeRows.map((row, index) => {
    const agenda = resolveAgenda(row);
    const attendanceSummary = summarizeAttendanceByCode(row?.student_attendance_mapel);
    const taskDelivery = resolveTaskDeliverySummary(row);
    return {
      No: index + 1,
      Tanggal: row?.tanggal || '-',
      Kelas: row?.schedule?.master_kelas?.nama_kelas || '-',
      Mapel: row?.schedule?.master_mapel?.nama_mapel || '-',
      Topik: agenda.topik,
      Metode: agenda.metode,
      H: attendanceSummary.H,
      S: attendanceSummary.S,
      I: attendanceSummary.I,
      A: attendanceSummary.A,
      Status: row?.status || '-',
      'Status Distribusi Tugas': taskDelivery.deliveryStatusLabel,
      'Waktu Distribusi': taskDelivery.deliveryTimeLabel,
      'Check-In': toLocalTimeLabel(row?.waktu_check_in),
      'Check-Out': toLocalTimeLabel(row?.waktu_check_out),
    };
  });
};
