import ExcelJS from 'exceljs';

const normalizeHeaderKey = (header) =>
  String(header || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');

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
