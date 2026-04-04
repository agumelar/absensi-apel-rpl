import ExcelJS from 'exceljs';

const normalizeHeaderKey = (header) =>
  String(header || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');

const formatHourMinuteWIB = (value) => {
  if (!value) return '-';
  const raw = String(value).trim();
  if (!raw || raw === '-') return '-';

  if (/^\d{2}:\d{2}$/.test(raw)) return raw;
  if (/^\d{2}\.\d{2}$/.test(raw)) return raw.replace('.', ':');
  if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) return raw.slice(0, 5);

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(parsed);

  const map = {};
  parts.forEach((part) => {
    map[part.type] = part.value;
  });

  return `${map.hour || '00'}:${map.minute || '00'}`;
};

export const exportJsonToExcel = async ({ rows, sheetName, fileName }) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName || 'Sheet1');
  const safeRows = Array.isArray(rows) ? rows : [];

  if (safeRows.length > 0) {
    const headers = Object.keys(safeRows[0]);
    worksheet.columns = headers.map((header) => ({
      header,
      key: header,
      width: Math.max(14, header.length + 2),
    }));
    safeRows.forEach((row) => {
      worksheet.addRow(row);
    });
  } else {
    worksheet.addRow(['No Data']);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName || 'export.xlsx';
  link.click();
  URL.revokeObjectURL(url);
};

export const exportWorkbookWithSheets = async ({ sheets = [], fileName = 'laporan.xlsx' } = {}) => {
  const workbook = new ExcelJS.Workbook();

  const safeSheets = Array.isArray(sheets) ? sheets.filter((item) => item && item.name) : [];
  if (safeSheets.length === 0) {
    const ws = workbook.addWorksheet('Sheet1');
    ws.addRow(['No Data']);
  } else {
    safeSheets.forEach((sheet) => {
      const worksheet = workbook.addWorksheet(String(sheet.name).slice(0, 31));
      const rows = Array.isArray(sheet.rows) ? sheet.rows : [];
      if (rows.length === 0) {
        worksheet.addRow(['No Data']);
        return;
      }

      const headers = Object.keys(rows[0]);
      worksheet.columns = headers.map((header) => ({
        header,
        key: header,
        width: Math.max(14, String(header).length + 2),
      }));
      rows.forEach((row) => worksheet.addRow(row));
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

export const exportMapelRecapToExcel = async ({
  meta = {},
  rows = [],
  sheetName = 'Rekap Kehadiran KBM',
  fileName = 'rekap-kbm.xlsx',
} = {}) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  worksheet.columns = [
    { key: 'no', width: 6 },
    { key: 'nama', width: 32 },
    { key: 'nis', width: 16 },
    { key: 'total', width: 16 },
    { key: 'h', width: 8 },
    { key: 's', width: 8 },
    { key: 'i', width: 8 },
    { key: 'a', width: 8 },
    { key: 'persen', width: 14 },
    { key: 'keterangan', width: 24 },
  ];

  const metadataRows = [
    ['Mapel', String(meta.mapelLabel || '-')],
    ['Kelas', String(meta.kelasLabel || '-')],
    ['Periode', String(meta.periodeLabel || '-')],
    ['Finalitas', String(meta.finalityLabel || 'Belum Final')],
  ];

  metadataRows.forEach(([label, value]) => {
    const row = worksheet.addRow(['', label, value]);
    row.getCell(2).font = { bold: true };
  });

  worksheet.addRow([]);

  const headerRow = worksheet.addRow([
    'No',
    'Nama',
    'NIS',
    'Total Pertemuan',
    'H',
    'S',
    'I',
    'A',
    '% Kehadiran',
    'Keterangan',
  ]);
  headerRow.font = { bold: true };

  const safeRows = Array.isArray(rows) ? rows : [];
  safeRows.forEach((item) => {
    worksheet.addRow([
      item.No ?? '',
      item.Nama ?? '-',
      item.NIS ?? '-',
      item['Total Pertemuan'] ?? 0,
      item.H ?? 0,
      item.S ?? 0,
      item.I ?? 0,
      item.A ?? 0,
      item['% Kehadiran'] ?? 0,
      item.Keterangan ?? '-',
    ]);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

export const exportMapelScoreRecapToExcel = async ({
  meta = {},
  rows = [],
  sheetName = 'Rekap Nilai Keaktifan KBM',
  fileName = 'rekap-nilai-harian-kbm.xlsx',
} = {}) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  worksheet.columns = [
    { key: 'no', width: 6 },
    { key: 'nama', width: 32 },
    { key: 'nis', width: 16 },
    { key: 'total', width: 16 },
    { key: 'frekuensi', width: 18 },
    { key: 'coverage', width: 12 },
    { key: 'totalPoin', width: 14 },
    { key: 'rataRata', width: 22 },
    { key: 'keterangan', width: 20 },
  ];

  const metadataRows = [
    ['Kelas', String(meta.kelasLabel || '-')],
    ['Mapel', String(meta.mapelLabel || '-')],
    ['Periode', String(meta.periodeLabel || '-')],
    ['Total Pertemuan', String(meta.totalPertemuanLabel || '0')],
    ['Jenis Rekap', 'Nilai Keaktifan (Bonus / Opsional)'],
  ];

  metadataRows.forEach(([label, value]) => {
    const row = worksheet.addRow(['', label, value]);
    row.getCell(2).font = { bold: true };
  });

  worksheet.addRow([]);

  const headerRow = worksheet.addRow([
    'No',
    'Nama',
    'NIS',
    'Total Pertemuan',
    'Frekuensi Dinilai',
    'Cakupan Penilaian (%)',
    'Total Poin',
    'Rata-rata Saat Diberi Nilai',
    'Keterangan',
  ]);
  headerRow.font = { bold: true };

  const safeRows = Array.isArray(rows) ? rows : [];
  safeRows.forEach((item) => {
    worksheet.addRow([
      item.No ?? '',
      item.Nama ?? '-',
      item.NIS ?? '-',
      item['Total Pertemuan'] ?? 0,
      item['Frekuensi Dinilai'] ?? 0,
      item['Cakupan Penilaian (%)'] ?? 0,
      item['Total Poin'] ?? 0,
      item['Rata-rata Saat Diberi Nilai'] ?? '-',
      item.Keterangan ?? '-',
    ]);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

export const exportMapelSessionHistoryToExcel = async ({
  meta = {},
  rows = [],
  sheetName = 'Riwayat Sesi Mapel',
  fileName = 'riwayat-sesi-mapel.xlsx',
} = {}) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  worksheet.columns = [
    { key: 'no', width: 6 },
    { key: 'tanggal', width: 14 },
    { key: 'kelas', width: 18 },
    { key: 'mapel', width: 26 },
    { key: 'topik', width: 34 },
    { key: 'metode', width: 20 },
    { key: 'h', width: 8 },
    { key: 's', width: 8 },
    { key: 'i', width: 8 },
    { key: 'a', width: 8 },
    { key: 'status', width: 16 },
    { key: 'taskDeliveryStatus', width: 26 },
    { key: 'taskDeliveryTime', width: 18 },
    { key: 'checkin', width: 14 },
    { key: 'checkout', width: 14 },
  ];

  const metadataRows = [
    ['Kelas', String(meta.kelasLabel || 'Semua Kelas')],
    ['Periode', String(meta.periodeLabel || '-')],
    ['Total Sesi', String(meta.totalSesiLabel || '0')],
  ];

  metadataRows.forEach(([label, value]) => {
    const row = worksheet.addRow(['', label, value]);
    row.getCell(2).font = { bold: true };
  });

  worksheet.addRow([]);

  const headerRow = worksheet.addRow([
    'No',
    'Tanggal',
    'Kelas',
    'Mapel',
    'Topik',
    'Metode',
    'H',
    'S',
    'I',
    'A',
    'Status',
    'Status Distribusi Tugas',
    'Waktu Distribusi',
    'Check-In',
    'Check-Out',
  ]);
  headerRow.font = { bold: true };

  const safeRows = Array.isArray(rows) ? rows : [];
  safeRows.forEach((item) => {
    worksheet.addRow([
      item.No ?? '',
      item.Tanggal ?? '-',
      item.Kelas ?? '-',
      item.Mapel ?? '-',
      item.Topik ?? '-',
      item.Metode ?? '-',
      item.H ?? 0,
      item.S ?? 0,
      item.I ?? 0,
      item.A ?? 0,
      item.Status ?? '-',
      item['Status Distribusi Tugas'] ?? '-',
      formatHourMinuteWIB(item['Waktu Distribusi']),
      formatHourMinuteWIB(item['Check-In']),
      formatHourMinuteWIB(item['Check-Out']),
    ]);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

export const exportTeacherPerformanceToExcel = async ({
  meta = {},
  summary = {},
  rows = [],
  monitorRows = [],
  historyRows = [],
  absenceRows = [],
  sheetName = 'Rekap_Bulanan',
  fileName = 'teacher-performance.xlsx',
} = {}) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  const metadataRows = [
    ['Periode', String(meta.periodeLabel || '-')],
    ['Scope', String(meta.roleScopeLabel || '-')],
    ['Trend By', String(meta.trendByLabel || '-')],
  ];

  metadataRows.forEach(([label, value]) => {
    const row = worksheet.addRow(['', label, value]);
    row.getCell(2).font = { bold: true };
  });

  worksheet.addRow([]);
  worksheet.addRow(['', 'Presence Rate', `${summary.presenceRate || 0}%`]);
  worksheet.addRow(['', 'Late Rate', `${summary.lateRate || 0}%`]);
  worksheet.addRow(['', 'Tidak Masuk Rate', `${summary.tidakMasukRate || 0}%`]);
  worksheet.addRow(['', 'Check-Out Completion Rate', `${summary.checkOutCompletionRate || 0}%`]);
  worksheet.addRow(['', 'SLA Breach Rate', `${summary.slaBreachRate || 0}%`]);
  worksheet.addRow(['', 'Kelas Terdampak', Number(summary.impactedClasses || 0)]);
  worksheet.addRow([]);

  const headerRow = worksheet.addRow([
    'No',
    'Guru',
    'Bulan',
    'Total Sesi Terjadwal',
    'Total Hadir',
    'Total Terlambat',
    'Tidak Masuk',
    'Total Tidak Check-Out',
    'Presence %',
    'Late %',
    'Tidak Masuk %',
    'Check-Out Completion %',
    'Kelas Terlibat',
    'Mapel Terlibat',
  ]);
  headerRow.font = { bold: true };

  const safeRows = Array.isArray(rows) ? rows : [];
  const bulanLabel = String(meta.bulanLabel || meta.periodeLabel || '-');
  safeRows.forEach((row, index) => {
    const checkInCount = Number(row.check_in_sessions || 0);
    const checkOutCount = Number(row.check_out_sessions || 0);
    const tidakCheckOut = Math.max(0, checkInCount - checkOutCount);
    worksheet.addRow([
      index + 1,
      row.guru_nama || '-',
      bulanLabel,
      Number(row.total_sessions || 0),
      Number(row.hadir_sessions || 0),
      Number(row.telat_sessions || 0),
      Number(row.tidak_masuk_sessions || 0),
      tidakCheckOut,
      Number(row.presence_rate || 0),
      Number(row.late_rate || 0),
      Number(row.tidak_masuk_rate || 0),
      Number(row.check_out_rate || 0),
      row.kelas_terakhir || '-',
      row.mapel_terakhir || '-',
    ]);
  });

  const monitorSheet = workbook.addWorksheet('Monitor_Hari_Ini');
  monitorSheet.addRow(['Tanggal', 'Jam', 'Guru', 'Kelas', 'Mapel', 'Status SLA', 'Check-In', 'Check-Out', 'Topik', 'Metode', 'H', 'S', 'I', 'A']);
  monitorSheet.getRow(1).font = { bold: true };
  (Array.isArray(monitorRows) ? monitorRows : []).forEach((item) => {
    monitorSheet.addRow([
      item.tanggal || '-',
      item.jam_label || '-',
      item.guru_nama || '-',
      item.kelas_nama || '-',
      item.mapel_nama || '-',
      item.sla_label || '-',
      formatHourMinuteWIB(item.waktu_check_in),
      formatHourMinuteWIB(item.waktu_check_out),
      item.agenda_topik || '-',
      item.agenda_metode || '-',
      Number(item.hadir || item.attendance_summary?.hadir || 0),
      Number(item.sakit || item.attendance_summary?.sakit || 0),
      Number(item.izin || item.attendance_summary?.izin || 0),
      Number(item.alpha || item.attendance_summary?.alpha || 0),
    ]);
  });
  if ((Array.isArray(monitorRows) ? monitorRows : []).length === 0) {
    monitorSheet.addRow(['Belum ada data monitor untuk export ini']);
  }

  const historySheet = workbook.addWorksheet('Riwayat_Detail');
  historySheet.addRow(['Tanggal', 'Guru', 'Kelas', 'Mapel', 'Status', 'Check-In', 'Check-Out', 'Topik', 'Metode']);
  historySheet.getRow(1).font = { bold: true };
  (Array.isArray(historyRows) ? historyRows : []).forEach((item) => {
    historySheet.addRow([
      item.tanggal || '-',
      item.guru_nama || '-',
      item.kelas_nama || '-',
      item.mapel_nama || '-',
      item.status || '-',
      formatHourMinuteWIB(item.waktu_check_in),
      formatHourMinuteWIB(item.waktu_check_out),
      item.agenda_topik || '-',
      item.agenda_metode || '-',
    ]);
  });
  if ((Array.isArray(historyRows) ? historyRows : []).length === 0) {
    historySheet.addRow(['Belum ada data riwayat untuk export ini']);
  }

  const absenceSheet = workbook.addWorksheet('Guru_Tidak_Masuk_Detail');
  absenceSheet.addRow([
    'Tanggal Tidak Masuk',
    'Nama Guru',
    'Kelas',
    'Mapel',
    'Instruksi Tugas',
    'Delivered oleh Piket',
    'Waktu Delivered',
  ]);
  absenceSheet.getRow(1).font = { bold: true };
  (Array.isArray(absenceRows) ? absenceRows : []).forEach((item) => {
    absenceSheet.addRow([
      item.tanggal || '-',
      item.guru_nama || '-',
      item.kelas_nama || '-',
      item.mapel_nama || '-',
      item.instruksi || item.absence_task?.instruksi || '-',
      item.delivered_by_picket ? 'Ya' : 'Tidak',
      formatHourMinuteWIB(item.delivered_at),
    ]);
  });
  if ((Array.isArray(absenceRows) ? absenceRows : []).length === 0) {
    absenceSheet.addRow(['Belum ada data guru tidak masuk untuk export ini']);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

export const exportMapelAuditSessionSummaryToExcel = async ({
  meta = {},
  summary = {},
  rows = [],
  sheetName = 'Audit Mapel Session Summary',
  fileName = 'audit-mapel-session-summary.xlsx',
} = {}) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  const metadataRows = [
    ['Periode', String(meta.periodeLabel || '-')],
    ['Kelas', String(meta.kelasLabel || 'Semua Kelas')],
    ['Mapel', String(meta.mapelLabel || 'Semua Mapel')],
    ['Presence Rate', `${summary?.presenceRate || 0}%`],
    ['Late Rate', `${summary?.lateRate || 0}%`],
    ['Tidak Masuk Rate', `${summary?.tidakMasukRate || 0}%`],
    ['SLA Breach Rate', `${summary?.slaBreachRate || 0}%`],
  ];

  metadataRows.forEach(([label, value]) => {
    const row = worksheet.addRow(['', label, value]);
    row.getCell(2).font = { bold: true };
  });

  worksheet.addRow([]);

  const headerRow = worksheet.addRow([
    'No',
    'Tanggal',
    'Guru',
    'Kelas',
    'Mapel',
    'Status',
    'Check-In',
    'Check-Out',
    'H',
    'S',
    'I',
    'A',
    'Topik',
    'Metode',
  ]);
  headerRow.font = { bold: true };

  const safeRows = Array.isArray(rows) ? rows : [];
  safeRows.forEach((row, index) => {
    worksheet.addRow([
      index + 1,
      row.tanggal || '-',
      row.guru_nama || '-',
      row.kelas_nama || '-',
      row.mapel_nama || '-',
      row.status || '-',
      formatHourMinuteWIB(row.waktu_check_in),
      formatHourMinuteWIB(row.waktu_check_out),
      Number(row.attendance_summary?.hadir || 0),
      Number(row.attendance_summary?.sakit || 0),
      Number(row.attendance_summary?.izin || 0),
      Number(row.attendance_summary?.alpha || 0),
      row.agenda_topik || '-',
      row.agenda_metode || '-',
    ]);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

export const readExcelFileToJson = async (file) => {
  if (!file) return [];

  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const headerRow = worksheet.getRow(1);
  const headers = [];
  headerRow.eachCell((cell, colNumber) => {
    headers[colNumber] = normalizeHeaderKey(cell.value);
  });

  const rows = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const record = {};
    let hasValue = false;
    row.eachCell((cell, colNumber) => {
      const key = headers[colNumber];
      if (!key) return;
      const value = cell.value ?? '';
      if (String(value).trim() !== '') hasValue = true;
      record[key] = typeof value === 'object' && value?.text ? value.text : value;
    });

    if (hasValue) rows.push(record);
  });

  return rows;
};
