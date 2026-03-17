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
