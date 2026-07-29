import ExcelJS from 'exceljs';
import JSZip from 'jszip';

const normalizeHeaderKey = (header) =>
  String(header || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');

// Parser CSV sederhana yang menghormati tanda kutip ganda ("..."), koma di dalam
// kutip, escape "" , serta pemisah baris CRLF/LF. Mengembalikan matriks string.
const parseCsvText = (text) => {
  const records = [];
  let field = '';
  let record = [];
  let inQuotes = false;

  const pushField = () => {
    record.push(field);
    field = '';
  };
  const pushRecord = () => {
    pushField();
    records.push(record);
    record = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      pushField();
    } else if (ch === '\r') {
      // Abaikan CR; tangani baris pada LF.
    } else if (ch === '\n') {
      pushRecord();
    } else {
      field += ch;
    }
  }
  // Baris terakhir tanpa newline penutup.
  if (field !== '' || record.length > 0) {
    pushRecord();
  }

  return records;
};

// Ubah matriks (array of array) menjadi array objek: baris pertama = header
// (dinormalisasi snake_case), baris berikutnya = data. Baris seluruhnya kosong diabaikan.
const matrixToRecords = (matrix) => {
  const filtered = (Array.isArray(matrix) ? matrix : []).filter((row) =>
    row.some((cell) => String(cell ?? '').trim() !== ''),
  );
  if (filtered.length === 0) return [];

  const headers = filtered[0].map((h) => normalizeHeaderKey(h));
  const rows = [];
  for (let r = 1; r < filtered.length; r += 1) {
    const record = {};
    let hasValue = false;
    filtered[r].forEach((value, index) => {
      const key = headers[index];
      if (!key) return;
      const cleaned = String(value ?? '').trim();
      if (cleaned !== '') hasValue = true;
      record[key] = cleaned;
    });
    if (hasValue) rows.push(record);
  }
  return rows;
};

const decodeXmlEntities = (value) =>
  String(value ?? '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');

// Kolom Excel (A, B, ..., AA) → indeks berbasis-0.
const columnRefToIndex = (ref) => {
  const letters = String(ref).match(/^[A-Z]+/)?.[0] || 'A';
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

// Fallback pembaca .xlsx via JSZip: membaca langsung XML di dalam berkas.
// Dipakai saat ExcelJS gagal (mis. berkas .xlsx buatan ExcelJS-browser yang
// Content_Types-nya cacat sehingga tidak dapat dibaca kembali oleh ExcelJS).
const parseXlsxWithJsZip = async (arrayBuffer) => {
  const zip = await JSZip.loadAsync(arrayBuffer);

  const sheetName = Object.keys(zip.files)
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name))
    .sort()[0];
  if (!sheetName) return [];

  const sheetXml = await zip.file(sheetName).async('string');
  const sharedFile = zip.file('xl/sharedStrings.xml');
  const sharedXml = sharedFile ? await sharedFile.async('string') : '';

  const shared = [];
  for (const si of sharedXml.matchAll(/<(?:\w+:)?si>([\s\S]*?)<\/(?:\w+:)?si>/g)) {
    const texts = [...si[1].matchAll(/<(?:\w+:)?t[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/g)].map((t) =>
      decodeXmlEntities(t[1]),
    );
    shared.push(texts.join(''));
  }

  const matrix = [];
  for (const rowMatch of sheetXml.matchAll(/<(?:\w+:)?row[^>]*>([\s\S]*?)<\/(?:\w+:)?row>/g)) {
    const cells = [];
    for (const cellMatch of rowMatch[1].matchAll(/<(?:\w+:)?c\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?c>/g)) {
      const attrs = cellMatch[1];
      const inner = cellMatch[2];
      const ref = attrs.match(/r="([A-Z]+\d+)"/)?.[1] || 'A1';
      const type = attrs.match(/t="([^"]+)"/)?.[1] || 'n';
      const valueMatch = inner.match(/<(?:\w+:)?v>([\s\S]*?)<\/(?:\w+:)?v>/);

      let value = '';
      if (type === 's') {
        value = shared[Number(valueMatch?.[1] ?? -1)] ?? '';
      } else if (type === 'inlineStr') {
        const inlineText = inner.match(/<(?:\w+:)?t[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/);
        value = decodeXmlEntities(inlineText?.[1] ?? '');
      } else {
        value = decodeXmlEntities(valueMatch?.[1] ?? '');
      }
      cells[columnRefToIndex(ref)] = value;
    }
    for (let i = 0; i < cells.length; i += 1) if (cells[i] === undefined) cells[i] = '';
    matrix.push(cells);
  }

  return matrixToRecords(matrix);
};

// Baca berkas CSV menjadi array objek dengan header ternormalisasi (snake_case),
// mengikuti bentuk keluaran yang sama dengan pembacaan Excel.
const readCsvFileToJson = async (file) => {
  const text = await file.text();
  const matrix = parseCsvText(text).filter((row) =>
    row.some((cell) => String(cell ?? '').trim() !== ''),
  );
  if (matrix.length === 0) return [];

  const headers = matrix[0].map((h) => normalizeHeaderKey(h));
  const rows = [];
  for (let r = 1; r < matrix.length; r += 1) {
    const record = {};
    let hasValue = false;
    matrix[r].forEach((value, index) => {
      const key = headers[index];
      if (!key) return;
      const cleaned = String(value ?? '').trim();
      if (cleaned !== '') hasValue = true;
      record[key] = cleaned;
    });
    if (hasValue) rows.push(record);
  }
  return rows;
};

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

export const exportPembiasaanReportToExcel = async ({
  meta = {},
  summary = {},
  monitoringRows = [],
  rankingRows = [],
  auditRows = [],
  fileName = 'Laporan_Pembiasaan.xlsx',
} = {}) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Jingga Asik';
  workbook.created = new Date();

  const colors = {
    navy: '173B66',
    blue: '2563EB',
    sky: 'EAF4FF',
    violet: '6D28D9',
    violetSoft: 'F1EAFF',
    green: '15803D',
    greenSoft: 'EAF8EF',
    amber: 'B45309',
    amberSoft: 'FFF4DB',
    rose: 'BE123C',
    roseSoft: 'FFE8EE',
    slate: '475569',
    slateSoft: 'F1F5F9',
    border: 'D9E2EC',
    white: 'FFFFFF',
  };

  const thinBorder = {
    top: { style: 'thin', color: { argb: colors.border } },
    left: { style: 'thin', color: { argb: colors.border } },
    bottom: { style: 'thin', color: { argb: colors.border } },
    right: { style: 'thin', color: { argb: colors.border } },
  };

  const styleTitle = (worksheet, lastColumn, title, subtitle) => {
    worksheet.mergeCells(`A1:${lastColumn}2`);
    const titleCell = worksheet.getCell('A1');
    titleCell.value = title;
    titleCell.font = { name: 'Aptos Display', size: 18, bold: true, color: { argb: colors.white } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.navy } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    worksheet.getRow(1).height = 25;
    worksheet.getRow(2).height = 14;

    worksheet.mergeCells(`A3:${lastColumn}3`);
    const subtitleCell = worksheet.getCell('A3');
    subtitleCell.value = subtitle;
    subtitleCell.font = { name: 'Aptos', size: 10, color: { argb: colors.slate } };
    subtitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.slateSoft } };
    subtitleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    worksheet.getRow(3).height = 22;
  };

  const applyWorksheetDefaults = (worksheet) => {
    worksheet.views = [{ state: 'frozen', ySplit: 5, showGridLines: false }];
    worksheet.properties.defaultRowHeight = 18;
    worksheet.pageSetup = {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    };
  };

  const addDataSheet = ({
    name,
    title,
    subtitle,
    rows,
    columns,
    statusKey,
    attentionKey,
    sourceKey,
  }) => {
    const worksheet = workbook.addWorksheet(name);
    const lastColumn = worksheet.getColumn(columns.length).letter;
    worksheet.columns = columns.map((column) => ({
      key: column.key,
      width: column.width,
    }));
    styleTitle(worksheet, lastColumn, title, subtitle);

    const headerRow = worksheet.getRow(5);
    headerRow.values = columns.map((column) => column.label);
    headerRow.height = 26;
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Aptos', size: 10, bold: true, color: { argb: colors.white } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.navy } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = thinBorder;
    });

    const safeRows = Array.isArray(rows) ? rows : [];
    if (safeRows.length === 0) {
      const emptyRow = worksheet.addRow(['Tidak ada data sesuai filter.']);
      worksheet.mergeCells(emptyRow.number, 1, emptyRow.number, columns.length);
      emptyRow.getCell(1).alignment = { horizontal: 'center' };
      emptyRow.getCell(1).font = { italic: true, color: { argb: colors.slate } };
    } else {
      safeRows.forEach((item, rowIndex) => {
        const row = worksheet.addRow(columns.map((column) => item?.[column.key] ?? '-'));
        row.height = 21;
        row.eachCell((cell, columnIndex) => {
          const column = columns[columnIndex - 1];
          cell.font = { name: 'Aptos', size: 9, color: { argb: '1F2937' } };
          cell.alignment = {
            vertical: 'middle',
            horizontal: column?.align || (column?.type === 'number' || column?.type === 'percent' ? 'right' : 'left'),
            wrapText: Boolean(column?.wrap),
          };
          cell.border = {
            bottom: { style: 'hair', color: { argb: colors.border } },
          };
          if (rowIndex % 2 === 1) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };
          }
          if (column?.type === 'number' && typeof cell.value === 'number') cell.numFmt = '#,##0.0';
          if (column?.type === 'integer' && typeof cell.value === 'number') cell.numFmt = '#,##0';
          if (column?.type === 'percent' && typeof cell.value === 'number') {
            cell.value = cell.value / 100;
            cell.numFmt = '0.0%';
          }
        });

        if (statusKey) {
          const statusColumnIndex = columns.findIndex((column) => column.key === statusKey) + 1;
          const statusCell = row.getCell(statusColumnIndex);
          const normalized = String(statusCell.value || '').toLowerCase();
          const tone =
            normalized === 'hadir'
              ? { fill: colors.greenSoft, font: colors.green }
              : normalized === 'izin'
                ? { fill: colors.sky, font: colors.blue }
                : normalized === 'sakit'
                  ? { fill: colors.amberSoft, font: colors.amber }
                  : { fill: colors.roseSoft, font: colors.rose };
          statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: tone.fill } };
          statusCell.font = { name: 'Aptos', size: 9, bold: true, color: { argb: tone.font } };
          statusCell.alignment = { horizontal: 'center', vertical: 'middle' };
        }

        if (attentionKey) {
          const attentionColumnIndex = columns.findIndex((column) => column.key === attentionKey) + 1;
          const attentionCell = row.getCell(attentionColumnIndex);
          if (Number(attentionCell.value || 0) > 0) {
            attentionCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.roseSoft } };
            attentionCell.font = { name: 'Aptos', size: 9, bold: true, color: { argb: colors.rose } };
          } else {
            attentionCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.greenSoft } };
            attentionCell.font = { name: 'Aptos', size: 9, bold: true, color: { argb: colors.green } };
          }
        }

        if (sourceKey) {
          const sourceColumnIndex = columns.findIndex((column) => column.key === sourceKey) + 1;
          const sourceCell = row.getCell(sourceColumnIndex);
          if (String(sourceCell.value || '').toLowerCase() === 'otomatis') {
            sourceCell.font = { name: 'Aptos', size: 9, bold: true, color: { argb: colors.rose } };
          }
        }
      });
    }

    worksheet.autoFilter = {
      from: { row: 5, column: 1 },
      to: { row: 5, column: columns.length },
    };
    applyWorksheetDefaults(worksheet);
    return worksheet;
  };

  const summarySheet = workbook.addWorksheet('Ringkasan');
  summarySheet.columns = [
    { width: 20 },
    { width: 16 },
    { width: 18 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 14 },
    { width: 18 },
  ];
  styleTitle(
    summarySheet,
    'H',
    'LAPORAN PEMBIASAAN',
    `Periode efektif ${meta.periodLabel || '-'} • Monitoring dimulai 20 Juli 2026`,
  );

  const infoValues = [
    ['Personel Sekolah', Number(summary.totalParticipants || 0)],
    ['Hari Aktif', Number(meta.activeDaysCount || 0)],
    ['Hari Libur', Number(meta.excludedHolidayCount || 0)],
    ['Filter Aktivitas', meta.activityLabel || 'Semua Aktivitas'],
  ];
  infoValues.forEach(([label, value], index) => {
    const startColumn = index * 2 + 1;
    const labelCell = summarySheet.getCell(5, startColumn);
    const valueCell = summarySheet.getCell(5, startColumn + 1);
    labelCell.value = label;
    valueCell.value = value;
    labelCell.font = { name: 'Aptos', size: 9, bold: true, color: { argb: colors.slate } };
    valueCell.font = { name: 'Aptos Display', size: 14, bold: true, color: { argb: colors.navy } };
    labelCell.fill = valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.slateSoft } };
    labelCell.border = valueCell.border = thinBorder;
    labelCell.alignment = valueCell.alignment = { vertical: 'middle' };
  });
  summarySheet.getRow(5).height = 34;

  const activityBlocks = [];
  if (!meta.activityType || meta.activityType === 'all' || meta.activityType === 'pembiasaan') {
    activityBlocks.push({
      title: 'PEMBIASAAN HARIAN',
      subtitle: 'Kewajiban seluruh personel pada hari aktif sekolah',
      data: summary.activities?.pembiasaan || {},
      color: colors.blue,
      soft: colors.sky,
    });
  }
  if (!meta.activityType || meta.activityType === 'all' || meta.activityType === 'sapa_pagi') {
    activityBlocks.push({
      title: 'SAPA PAGI',
      subtitle: 'Khusus personel yang terjadwal sebagai petugas',
      data: summary.activities?.sapa_pagi || {},
      color: colors.violet,
      soft: colors.violetSoft,
    });
  }

  let activityStartRow = 7;
  activityBlocks.forEach((block) => {
    summarySheet.mergeCells(activityStartRow, 1, activityStartRow, 8);
    const sectionCell = summarySheet.getCell(activityStartRow, 1);
    sectionCell.value = `${block.title} — ${block.subtitle}`;
    sectionCell.font = { name: 'Aptos', size: 11, bold: true, color: { argb: colors.white } };
    sectionCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: block.color } };
    sectionCell.alignment = { vertical: 'middle' };
    summarySheet.getRow(activityStartRow).height = 24;

    const headers = [
      'Kewajiban',
      'Personel Berkewajiban',
      'Sudah Melapor',
      'Hadir',
      'Izin',
      'Sakit',
      'Alpha',
      'Belum Tercatat',
    ];
    const values = [
      Number(block.data.obligations || 0),
      Number(block.data.scheduledParticipants || 0),
      Number(block.data.validReports || 0),
      Number(block.data.hadir || 0),
      Number(block.data.izin || 0),
      Number(block.data.sakit || 0),
      Number(block.data.alpha || 0),
      Number(block.data.missingUnrecorded || 0),
    ];
    const headerRow = summarySheet.getRow(activityStartRow + 1);
    const valueRow = summarySheet.getRow(activityStartRow + 2);
    headerRow.values = headers;
    valueRow.values = values;
    headerRow.height = 28;
    valueRow.height = 30;
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Aptos', size: 9, bold: true, color: { argb: colors.slate } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: block.soft } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = thinBorder;
    });
    valueRow.eachCell((cell, columnNumber) => {
      cell.font = {
        name: 'Aptos Display',
        size: 15,
        bold: true,
        color: {
          argb: columnNumber === 7 || columnNumber === 8 ? colors.rose : columnNumber === 4 ? colors.green : colors.navy,
        },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = thinBorder;
      cell.numFmt = '#,##0';
    });
    activityStartRow += 5;
  });

  summarySheet.mergeCells(activityStartRow, 1, activityStartRow, 8);
  const guideTitle = summarySheet.getCell(activityStartRow, 1);
  guideTitle.value = 'CARA MEMBACA';
  guideTitle.font = { name: 'Aptos', size: 10, bold: true, color: { argb: colors.navy } };
  guideTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.slateSoft } };
  summarySheet.mergeCells(activityStartRow + 1, 1, activityStartRow + 2, 8);
  const guideBody = summarySheet.getCell(activityStartRow + 1, 1);
  guideBody.value =
    'Sudah Melapor = Hadir + Izin + Sakit. Ditindaklanjuti = Alpha + Belum Tercatat. Petugas Sapa Pagi dapat memiliki dua kewajiban pada hari tugasnya: Sapa Pagi dan Pembiasaan Harian.';
  guideBody.font = { name: 'Aptos', size: 10, color: { argb: colors.slate } };
  guideBody.alignment = { vertical: 'middle', wrapText: true };
  guideBody.border = thinBorder;
  summarySheet.getRow(activityStartRow + 1).height = 26;
  summarySheet.getRow(activityStartRow + 2).height = 20;
  summarySheet.views = [{ showGridLines: false }];
  summarySheet.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  };

  addDataSheet({
    name: 'Peringkat Perhatian',
    title: 'PERINGKAT PERHATIAN PERSONEL',
    subtitle: `Periode ${meta.periodLabel || '-'} • Urutan berdasarkan Alpha dan data yang belum tercatat`,
    rows: rankingRows,
    columns: [
      { key: 'Peringkat', label: 'Peringkat', width: 11, type: 'integer', align: 'center' },
      { key: 'Nama', label: 'Nama Personel', width: 34 },
      { key: 'Role', label: 'Peran', width: 17 },
      { key: 'Hadir', label: 'Hadir', width: 10, type: 'integer', align: 'center' },
      { key: 'Izin', label: 'Izin', width: 9, type: 'integer', align: 'center' },
      { key: 'Sakit', label: 'Sakit', width: 9, type: 'integer', align: 'center' },
      { key: 'Alpha', label: 'Alpha', width: 10, type: 'integer', align: 'center' },
      { key: 'Belum Tercatat', label: 'Belum Tercatat', width: 15, type: 'integer', align: 'center' },
      { key: 'Perlu Perhatian', label: 'Ditindaklanjuti', width: 16, type: 'integer', align: 'center' },
      { key: 'Sudah Melapor', label: 'Sudah Melapor', width: 15, type: 'integer', align: 'center' },
      { key: 'Kewajiban', label: 'Kewajiban', width: 13, type: 'integer', align: 'center' },
      { key: 'Sudah Melapor (%)', label: 'Sudah Melapor (%)', width: 17, type: 'percent', align: 'center' },
    ],
    attentionKey: 'Perlu Perhatian',
  });

  addDataSheet({
    name: 'Monitoring Harian',
    title: 'MONITORING HARIAN PEMBIASAAN',
    subtitle: `Tanggal fokus ${meta.focusDate || '-'} • ${meta.activityLabel || 'Semua Aktivitas'} • Status ${meta.statusLabel || 'Semua'}`,
    rows: monitoringRows,
    columns: [
      { key: 'Tanggal', label: 'Tanggal', width: 14, align: 'center' },
      { key: 'Aktivitas', label: 'Aktivitas', width: 18 },
      { key: 'Nama', label: 'Nama Personel', width: 34 },
      { key: 'Role', label: 'Peran', width: 17 },
      { key: 'Status', label: 'Status', width: 12, align: 'center' },
      { key: 'Jam', label: 'Jam', width: 10, align: 'center' },
      { key: 'Jarak (m)', label: 'Jarak (m)', width: 13, type: 'number' },
      { key: 'Sumber', label: 'Sumber Catatan', width: 16 },
      { key: 'Catatan', label: 'Catatan', width: 32, wrap: true },
    ],
    statusKey: 'Status',
    sourceKey: 'Sumber',
  });

  addDataSheet({
    name: 'Data Audit',
    title: 'DATA AUDIT PEMBIASAAN',
    subtitle: `Periode ${meta.periodLabel || '-'} • Riwayat status dan bukti kegiatan`,
    rows: auditRows,
    columns: [
      { key: 'Tanggal', label: 'Tanggal', width: 14 },
      { key: 'Aktivitas', label: 'Aktivitas', width: 17 },
      { key: 'Nama', label: 'Nama Personel', width: 32 },
      { key: 'Status', label: 'Status', width: 11 },
      { key: 'Jam', label: 'Jam', width: 10 },
      { key: 'Foto', label: 'Path Foto', width: 42 },
      { key: 'Jarak (m)', label: 'Jarak (m)', width: 12, type: 'number' },
      { key: 'Sumber Bukti', label: 'Sumber Bukti', width: 17 },
    ],
    statusKey: 'Status',
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
  fileName = 'teacher-performance.xlsx',
} = {}) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Jingga Asik';
  workbook.created = new Date();

  const colors = {
    navy: '173B66',
    blue: '2563EB',
    sky: 'EAF4FF',
    green: '15803D',
    greenSoft: 'EAF8EF',
    amber: 'B45309',
    amberSoft: 'FFF4DB',
    rose: 'BE123C',
    roseSoft: 'FFE8EE',
    slate: '475569',
    slateSoft: 'F1F5F9',
    border: 'D9E2EC',
    white: 'FFFFFF',
  };
  const thinBorder = {
    top: { style: 'thin', color: { argb: colors.border } },
    left: { style: 'thin', color: { argb: colors.border } },
    bottom: { style: 'thin', color: { argb: colors.border } },
    right: { style: 'thin', color: { argb: colors.border } },
  };

  const styleTitle = (worksheet, lastColumn, title, subtitle) => {
    worksheet.mergeCells(`A1:${lastColumn}2`);
    const titleCell = worksheet.getCell('A1');
    titleCell.value = title;
    titleCell.font = { name: 'Aptos Display', size: 18, bold: true, color: { argb: colors.white } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.navy } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    worksheet.getRow(1).height = 25;
    worksheet.getRow(2).height = 14;

    worksheet.mergeCells(`A3:${lastColumn}3`);
    const subtitleCell = worksheet.getCell('A3');
    subtitleCell.value = subtitle;
    subtitleCell.font = { name: 'Aptos', size: 10, color: { argb: colors.slate } };
    subtitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.slateSoft } };
    subtitleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    worksheet.getRow(3).height = 22;
  };

  const applyWorksheetDefaults = (worksheet, freezeRow = 5) => {
    worksheet.views = [{ state: 'frozen', ySplit: freezeRow, showGridLines: false }];
    worksheet.properties.defaultRowHeight = 18;
    worksheet.pageSetup = {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
    };
  };

  const getAttentionLabel = (score) => {
    const value = Number(score || 0);
    if (value >= 12) return 'Prioritas Tinggi';
    if (value >= 5) return 'Perlu Perhatian';
    return 'Terpantau';
  };

  const getStatusTone = (value) => {
    const normalized = String(value || '').toLowerCase();
    if (
      normalized.includes('tepat waktu') ||
      normalized.includes('sudah check-in') ||
      normalized.includes('terpantau')
    ) {
      return { fill: colors.greenSoft, font: colors.green };
    }
    if (
      normalized.includes('terlambat') ||
      normalized.includes('menunggu') ||
      normalized.includes('perlu perhatian')
    ) {
      return { fill: colors.amberSoft, font: colors.amber };
    }
    if (
      normalized.includes('lupa absen') ||
      normalized.includes('tidak masuk') ||
      normalized.includes('belum check-in') ||
      normalized.includes('prioritas tinggi')
    ) {
      return { fill: colors.roseSoft, font: colors.rose };
    }
    return { fill: colors.slateSoft, font: colors.slate };
  };

  const addDataSheet = ({ name, title, subtitle, rows: dataRows, columns, statusKey, attentionKey }) => {
    const worksheet = workbook.addWorksheet(name);
    worksheet.columns = columns.map((column) => ({ key: column.key, width: column.width }));
    const lastColumn = worksheet.getColumn(columns.length).letter;
    styleTitle(worksheet, lastColumn, title, subtitle);

    const headerRow = worksheet.getRow(5);
    headerRow.values = columns.map((column) => column.label);
    headerRow.height = 30;
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Aptos', size: 9, bold: true, color: { argb: colors.white } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.navy } };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      cell.border = thinBorder;
    });

    const safeDataRows = Array.isArray(dataRows) ? dataRows : [];
    if (safeDataRows.length === 0) {
      const emptyRow = worksheet.addRow(['Tidak ada data sesuai filter.']);
      worksheet.mergeCells(emptyRow.number, 1, emptyRow.number, columns.length);
      emptyRow.getCell(1).alignment = { horizontal: 'center' };
      emptyRow.getCell(1).font = { name: 'Aptos', size: 10, italic: true, color: { argb: colors.slate } };
    } else {
      safeDataRows.forEach((item, rowIndex) => {
        const dataRow = worksheet.addRow(columns.map((column) => item?.[column.key] ?? '-'));
        dataRow.height = columns.some((column) => column.wrap) ? 27 : 21;
        dataRow.eachCell((cell, columnIndex) => {
          const column = columns[columnIndex - 1];
          cell.font = { name: 'Aptos', size: 9, color: { argb: '1F2937' } };
          cell.alignment = {
            vertical: 'middle',
            horizontal:
              column?.align || (['integer', 'number', 'percent'].includes(column?.type) ? 'right' : 'left'),
            wrapText: Boolean(column?.wrap),
          };
          cell.border = { bottom: { style: 'hair', color: { argb: colors.border } } };
          if (rowIndex % 2 === 1) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };
          }
          if (column?.type === 'integer' && typeof cell.value === 'number') cell.numFmt = '#,##0';
          if (column?.type === 'number' && typeof cell.value === 'number') cell.numFmt = '#,##0.0';
          if (column?.type === 'percent' && typeof cell.value === 'number') {
            cell.value /= 100;
            cell.numFmt = '0.0%';
          }
        });

        if (statusKey) {
          const statusColumnIndex = columns.findIndex((column) => column.key === statusKey) + 1;
          const statusCell = dataRow.getCell(statusColumnIndex);
          const tone = getStatusTone(statusCell.value);
          statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: tone.fill } };
          statusCell.font = { name: 'Aptos', size: 9, bold: true, color: { argb: tone.font } };
          statusCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        }

        if (attentionKey) {
          const attentionColumnIndex = columns.findIndex((column) => column.key === attentionKey) + 1;
          const attentionCell = dataRow.getCell(attentionColumnIndex);
          const tone = getStatusTone(attentionCell.value);
          attentionCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: tone.fill } };
          attentionCell.font = { name: 'Aptos', size: 9, bold: true, color: { argb: tone.font } };
          attentionCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        }
      });
    }

    worksheet.autoFilter = {
      from: { row: 5, column: 1 },
      to: { row: 5, column: columns.length },
    };
    applyWorksheetDefaults(worksheet);
    return worksheet;
  };

  const safeRows = Array.isArray(rows) ? rows : [];
  const safeMonitorRows = Array.isArray(monitorRows) ? monitorRows : [];
  const safeHistoryRows = Array.isArray(historyRows) ? historyRows : [];
  const safeAbsenceRows = Array.isArray(absenceRows) ? absenceRows : [];

  const summarySheet = workbook.addWorksheet('Ringkasan');
  summarySheet.columns = Array.from({ length: 8 }, () => ({ width: 18 }));
  styleTitle(
    summarySheet,
    'H',
    'LAPORAN KINERJA KEHADIRAN GURU',
    `Periode efektif ${meta.periodeLabel || '-'} • ${meta.roleScopeLabel || '-'}`,
  );

  [
    ['Guru Dinilai', Number(summary.totalTeachers || safeRows.length || 0)],
    ['Jadwal Dinilai', Number(summary.totalScheduled || 0)],
    ['Kelas Terdampak', Number(summary.impactedClasses || 0)],
    ['Bulan Laporan', String(meta.bulanLabel || '-')],
  ].forEach(([label, value], index) => {
    const startColumn = index * 2 + 1;
    const labelCell = summarySheet.getCell(5, startColumn);
    const valueCell = summarySheet.getCell(5, startColumn + 1);
    labelCell.value = label;
    valueCell.value = value;
    labelCell.font = { name: 'Aptos', size: 9, bold: true, color: { argb: colors.slate } };
    valueCell.font = { name: 'Aptos Display', size: 14, bold: true, color: { argb: colors.navy } };
    labelCell.fill = valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.slateSoft } };
    labelCell.border = valueCell.border = thinBorder;
    labelCell.alignment = valueCell.alignment = { vertical: 'middle' };
  });
  summarySheet.getRow(5).height = 34;

  summarySheet.mergeCells('A7:H7');
  const countSection = summarySheet.getCell('A7');
  countSection.value = 'HASIL MONITORING';
  countSection.font = { name: 'Aptos', size: 11, bold: true, color: { argb: colors.white } };
  countSection.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.blue } };
  countSection.alignment = { vertical: 'middle' };
  const countHeaders = ['Jadwal', 'Hadir', 'Lupa Absen', 'Tidak Masuk Dilaporkan', 'Lewat SLA', 'Terlambat', 'Belum Check-Out', 'Sesi Tercatat'];
  const countValues = [
    Number(summary.totalScheduled || 0),
    Number(summary.totalHadir || 0),
    Number(summary.totalLupaAbsen || 0),
    Number(summary.totalConfirmedAbsence || 0),
    Number(
      summary.totalSlaBreach ||
        safeRows.reduce((total, row) => total + Number(row.sla_breach_sessions || 0), 0),
    ),
    Number(summary.totalLate || 0),
    Number(summary.totalMissingCheckOut || 0),
    Number(summary.totalSessions || 0),
  ];
  summarySheet.getRow(8).values = countHeaders;
  summarySheet.getRow(9).values = countValues;
  summarySheet.getRow(8).height = 30;
  summarySheet.getRow(9).height = 32;
  summarySheet.getRow(8).eachCell((cell) => {
    cell.font = { name: 'Aptos', size: 9, bold: true, color: { argb: colors.slate } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.sky } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = thinBorder;
  });
  summarySheet.getRow(9).eachCell((cell, columnNumber) => {
    const attentionColumns = [3, 4, 5, 6, 7];
    cell.font = {
      name: 'Aptos Display',
      size: 15,
      bold: true,
      color: { argb: attentionColumns.includes(columnNumber) ? colors.rose : columnNumber === 2 ? colors.green : colors.navy },
    };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = thinBorder;
    cell.numFmt = '#,##0';
  });

  summarySheet.mergeCells('A11:H11');
  const rateSection = summarySheet.getCell('A11');
  rateSection.value = 'TINGKAT KEPATUHAN';
  rateSection.font = { name: 'Aptos', size: 11, bold: true, color: { argb: colors.white } };
  rateSection.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.green } };
  rateSection.alignment = { vertical: 'middle' };
  const rateHeaders = ['Kehadiran', 'Terlambat', 'Tidak Masuk', 'Check-Out Selesai', 'Lewat SLA'];
  const rateValues = [
    Number(summary.presenceRate || 0) / 100,
    Number(summary.lateRate || 0) / 100,
    Number(summary.tidakMasukRate || 0) / 100,
    Number(summary.checkOutCompletionRate || 0) / 100,
    Number(summary.slaBreachRate || 0) / 100,
  ];
  summarySheet.getRow(12).values = rateHeaders;
  summarySheet.getRow(13).values = rateValues;
  summarySheet.getRow(12).height = 28;
  summarySheet.getRow(13).height = 30;
  summarySheet.getRow(12).eachCell((cell) => {
    cell.font = { name: 'Aptos', size: 9, bold: true, color: { argb: colors.slate } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.greenSoft } };
    cell.border = thinBorder;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  summarySheet.getRow(13).eachCell((cell) => {
    cell.font = { name: 'Aptos Display', size: 14, bold: true, color: { argb: colors.navy } };
    cell.numFmt = '0.0%';
    cell.border = thinBorder;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  summarySheet.mergeCells('A15:H15');
  const guideTitle = summarySheet.getCell('A15');
  guideTitle.value = 'CARA MEMBACA';
  guideTitle.font = { name: 'Aptos', size: 10, bold: true, color: { argb: colors.navy } };
  guideTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: colors.slateSoft } };
  summarySheet.mergeCells('A16:H18');
  const guideBody = summarySheet.getCell('A16');
  guideBody.value =
    'Peringkat 1 adalah guru yang paling perlu ditinjau untuk pembinaan internal. Skor Perhatian = Lupa Absen ×4 + Lewat SLA ×3 + Terlambat ×2 + Tidak Masuk Dilaporkan ×2 + Belum Check-Out ×1. Lupa Absen berarti jadwal selesai tanpa sesi/check-in; berbeda dari Tidak Masuk Dilaporkan. ' +
    (meta.holidayPolicyLabel || 'Hari libur dan jadwal yang belum dimulai tidak dinilai.');
  guideBody.font = { name: 'Aptos', size: 10, color: { argb: colors.slate } };
  guideBody.alignment = { vertical: 'middle', wrapText: true };
  guideBody.border = thinBorder;
  summarySheet.getRow(16).height = 28;
  summarySheet.getRow(17).height = 24;
  summarySheet.getRow(18).height = 24;
  summarySheet.views = [{ showGridLines: false }];
  summarySheet.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 1,
    margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
  };

  addDataSheet({
    name: 'Peringkat Perhatian',
    title: 'PERINGKAT PERHATIAN GURU',
    subtitle: `Periode ${meta.periodeLabel || '-'} • Peringkat 1 paling perlu ditinjau`,
    rows: safeRows.map((row, index) => ({
      peringkat: index + 1,
      guru: row.guru_nama || '-',
      prioritas: getAttentionLabel(row.attention_score),
      skor: Number(row.attention_score || 0),
      jadwal: Number(row.total_sessions || 0),
      hadir: Number(row.hadir_sessions || 0),
      lupaAbsen: Number(row.lupa_absen_sessions || 0),
      tidakMasuk: Number(row.confirmed_absence_sessions || 0),
      lewatSla: Number(row.pending_sessions || 0) > 0 ? Number(row.sla_breach_sessions || 0) : 0,
      terlambat: Number(row.telat_sessions || 0),
      belumCheckOut: Number(row.missing_check_out_sessions || 0),
      kehadiran: Number(row.presence_rate || 0),
      terlambatRate: Number(row.late_rate || 0),
      checkOutRate: row.check_out_rate == null ? '-' : Number(row.check_out_rate || 0),
      kelas: row.kelas_terakhir || '-',
      mapel: row.mapel_terakhir || '-',
    })),
    columns: [
      { key: 'peringkat', label: 'Peringkat', width: 10, type: 'integer', align: 'center' },
      { key: 'guru', label: 'Nama Guru', width: 34 },
      { key: 'prioritas', label: 'Prioritas', width: 18, align: 'center' },
      { key: 'skor', label: 'Skor Perhatian', width: 15, type: 'integer', align: 'center' },
      { key: 'jadwal', label: 'Jadwal Dinilai', width: 14, type: 'integer', align: 'center' },
      { key: 'hadir', label: 'Hadir', width: 10, type: 'integer', align: 'center' },
      { key: 'lupaAbsen', label: 'Lupa Absen', width: 13, type: 'integer', align: 'center' },
      { key: 'tidakMasuk', label: 'Tidak Masuk Dilaporkan', width: 18, type: 'integer', align: 'center' },
      { key: 'lewatSla', label: 'Lewat SLA (Skor)', width: 14, type: 'integer', align: 'center' },
      { key: 'terlambat', label: 'Terlambat', width: 12, type: 'integer', align: 'center' },
      { key: 'belumCheckOut', label: 'Belum Check-Out', width: 16, type: 'integer', align: 'center' },
      { key: 'kehadiran', label: 'Kehadiran (%)', width: 14, type: 'percent', align: 'center' },
      { key: 'terlambatRate', label: 'Terlambat (%)', width: 14, type: 'percent', align: 'center' },
      { key: 'checkOutRate', label: 'Check-Out Selesai (%)', width: 18, type: 'percent', align: 'center' },
      { key: 'kelas', label: 'Kelas Terakhir', width: 16 },
      { key: 'mapel', label: 'Mapel Terakhir', width: 34, wrap: true },
    ],
    attentionKey: 'prioritas',
  });

  addDataSheet({
    name: 'Monitoring Hari Ini',
    title: 'MONITORING KEGIATAN HARI INI',
    subtitle: 'Status jadwal, check-in, check-out, agenda pembelajaran, dan rekap kehadiran siswa',
    rows: safeMonitorRows.map((item) => ({
      tanggal: item.tanggal || '-',
      jadwal:
        item.jam_label ||
        (item.jam_mulai && item.jam_selesai
          ? `${String(item.jam_mulai).slice(0, 5)}-${String(item.jam_selesai).slice(0, 5)}`
          : '-'),
      guru: item.guru_nama || '-',
      kelas: item.kelas_nama || '-',
      mapel: item.mapel_nama || '-',
      status: item.monitor_status?.label || item.warning_label || item.sla_label || '-',
      checkIn: formatHourMinuteWIB(item.waktu_check_in),
      checkOut: formatHourMinuteWIB(item.waktu_check_out),
      topik: item.agenda_topik || '-',
      metode: item.agenda_metode || '-',
      hadir: Number(item.hadir || item.attendance_summary?.hadir || 0),
      sakit: Number(item.sakit || item.attendance_summary?.sakit || 0),
      izin: Number(item.izin || item.attendance_summary?.izin || 0),
      alpha: Number(item.alpha || item.attendance_summary?.alpha || 0),
    })),
    columns: [
      { key: 'tanggal', label: 'Tanggal', width: 14, align: 'center' },
      { key: 'jadwal', label: 'Jadwal', width: 14, align: 'center' },
      { key: 'guru', label: 'Nama Guru', width: 31 },
      { key: 'kelas', label: 'Kelas', width: 14 },
      { key: 'mapel', label: 'Mata Pelajaran', width: 30, wrap: true },
      { key: 'status', label: 'Status', width: 24, align: 'center', wrap: true },
      { key: 'checkIn', label: 'Check-In', width: 12, align: 'center' },
      { key: 'checkOut', label: 'Check-Out', width: 12, align: 'center' },
      { key: 'topik', label: 'Agenda Pembelajaran', width: 34, wrap: true },
      { key: 'metode', label: 'Metode', width: 18, wrap: true },
      { key: 'hadir', label: 'H', width: 7, type: 'integer', align: 'center' },
      { key: 'sakit', label: 'S', width: 7, type: 'integer', align: 'center' },
      { key: 'izin', label: 'I', width: 7, type: 'integer', align: 'center' },
      { key: 'alpha', label: 'A', width: 7, type: 'integer', align: 'center' },
    ],
    statusKey: 'status',
  });

  addDataSheet({
    name: 'Riwayat Kegiatan',
    title: 'RIWAYAT KEGIATAN PEMBELAJARAN',
    subtitle: `Periode ${meta.periodeLabel || '-'} • Bukti pelaksanaan KBM dan indikator yang perlu ditinjau`,
    rows: safeHistoryRows.map((item) => ({
      tanggal: item.tanggal || '-',
      jadwal: item.jam_label || '-',
      guru: item.guru_nama || '-',
      kelas: item.kelas_nama || '-',
      mapel: item.mapel_nama || '-',
      status: item.status || '-',
      checkIn: formatHourMinuteWIB(item.waktu_check_in),
      checkOut: formatHourMinuteWIB(item.waktu_check_out),
      topik: item.agenda_topik || '-',
      metode: item.agenda_metode || '-',
      hadir: Number(item.attendance_summary?.hadir || 0),
      sakit: Number(item.attendance_summary?.sakit || 0),
      izin: Number(item.attendance_summary?.izin || 0),
      alpha: Number(item.attendance_summary?.alpha || 0),
    })),
    columns: [
      { key: 'tanggal', label: 'Tanggal', width: 14, align: 'center' },
      { key: 'jadwal', label: 'Jadwal', width: 14, align: 'center' },
      { key: 'guru', label: 'Nama Guru', width: 31 },
      { key: 'kelas', label: 'Kelas', width: 14 },
      { key: 'mapel', label: 'Mata Pelajaran', width: 30, wrap: true },
      { key: 'status', label: 'Status Kehadiran', width: 24, align: 'center', wrap: true },
      { key: 'checkIn', label: 'Check-In', width: 12, align: 'center' },
      { key: 'checkOut', label: 'Check-Out', width: 12, align: 'center' },
      { key: 'topik', label: 'Agenda Pembelajaran', width: 34, wrap: true },
      { key: 'metode', label: 'Metode', width: 18, wrap: true },
      { key: 'hadir', label: 'H', width: 7, type: 'integer', align: 'center' },
      { key: 'sakit', label: 'S', width: 7, type: 'integer', align: 'center' },
      { key: 'izin', label: 'I', width: 7, type: 'integer', align: 'center' },
      { key: 'alpha', label: 'A', width: 7, type: 'integer', align: 'center' },
    ],
    statusKey: 'status',
  });

  addDataSheet({
    name: 'Detail Ketidakhadiran',
    title: 'DETAIL KETIDAKHADIRAN GURU',
    subtitle: `Periode ${meta.periodeLabel || '-'} • Pisahkan lupa absen dari ketidakhadiran yang dilaporkan`,
    rows: safeAbsenceRows.map((item) => {
      const task = item.absence_task || {};
      const isReported = String(item.attention_type || '') === 'confirmed_absence';
      return {
        tanggal: item.tanggal || '-',
        guru: item.guru_nama || '-',
        kelas: item.kelas_nama || '-',
        mapel: item.mapel_nama || '-',
        jenis: isReported ? 'Tidak Masuk Dilaporkan' : 'Lupa Absen / Tidak Absen',
        instruksi: item.instruksi || task.instruksi || '-',
        distribusi: !isReported
          ? 'Tidak Berlaku'
          : task.delivered_by_picket || item.delivered_by_picket
            ? 'Sudah Didistribusikan'
            : 'Belum Didistribusikan',
        waktuDistribusi: formatHourMinuteWIB(task.delivered_at || item.delivered_at),
      };
    }),
    columns: [
      { key: 'tanggal', label: 'Tanggal', width: 14, align: 'center' },
      { key: 'guru', label: 'Nama Guru', width: 32 },
      { key: 'kelas', label: 'Kelas', width: 14 },
      { key: 'mapel', label: 'Mata Pelajaran', width: 31, wrap: true },
      { key: 'jenis', label: 'Jenis Catatan', width: 24, align: 'center', wrap: true },
      { key: 'instruksi', label: 'Instruksi / Tugas', width: 42, wrap: true },
      { key: 'distribusi', label: 'Status Distribusi', width: 22, align: 'center', wrap: true },
      { key: 'waktuDistribusi', label: 'Waktu Distribusi', width: 17, align: 'center' },
    ],
    statusKey: 'jenis',
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

  // Berkas CSV diproses sebagai teks (ExcelJS xlsx.load hanya untuk .xlsx).
  const extension = String(file.name || '').split('.').pop()?.toLowerCase() || '';
  const isCsv = extension === 'csv' || file.type === 'text/csv';
  if (isCsv) {
    return readCsvFileToJson(file);
  }

  const arrayBuffer = await file.arrayBuffer();

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(arrayBuffer);
  } catch (error) {
    // Berkas .xlsx yang tidak dapat dibaca ExcelJS (mis. buatan ExcelJS-browser
    // dengan Content_Types cacat) → coba fallback baca langsung via JSZip.
    try {
      return await parseXlsxWithJsZip(arrayBuffer);
    } catch {
      throw error;
    }
  }

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

// Template diunduh sebagai .xlsx (bisa dibuka native di Excel). Meskipun berkas
// .xlsx buatan ExcelJS-browser tidak dapat dibaca ulang oleh ExcelJS, pembaca
// readExcelFileToJson kini memiliki fallback JSZip sehingga berkas ini tetap
// dapat diunggah ulang dengan aman. Header persis: tanggal_mulai, tanggal_selesai,
// keterangan (Req 2.4).
export const downloadKalenderTemplate = async () => {
  const rows = [
    {
      tanggal_mulai: '2025-12-23',
      tanggal_selesai: '2026-01-04',
      keterangan: 'Libur Semester Ganjil',
    },
    // Contoh tanggal tunggal: tanggal_mulai == tanggal_selesai.
    {
      tanggal_mulai: '2026-05-01',
      tanggal_selesai: '2026-05-01',
      keterangan: 'Hari Buruh',
    },
  ];

  // Bila unduhan gagal, biarkan error terlempar (tidak ditelan) agar UI
  // menampilkan pesan galat dalam Bahasa Indonesia (Req 2.5).
  await exportJsonToExcel({
    rows,
    sheetName: 'Template Kalender',
    fileName: 'template-kalender-pendidikan.xlsx',
  });
};
