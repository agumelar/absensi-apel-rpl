import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildRecapExcelDataRows,
  buildRecapRequestPeriod,
  buildRecapExcelTableRows,
  buildPeriodRange,
  buildStudentRecapRows,
  formatRecapPeriodLabel,
  summarizeRecapRows,
} from './attendanceRecapRules.js';

test('buildPeriodRange monthly returns first day to selected day', () => {
  const range = buildPeriodRange({ mode: 'monthly', anchorDate: '2026-04-15' });

  assert.equal(range.fromDate, '2026-04-01');
  assert.equal(range.toDate, '2026-04-15');
});

test('buildPeriodRange range works without anchorDate', () => {
  const range = buildPeriodRange({
    mode: 'range',
    fromDate: '2026-04-01',
    toDate: '2026-04-10',
  });

  assert.equal(range.fromDate, '2026-04-01');
  assert.equal(range.toDate, '2026-04-10');
  assert.equal(range.label, 'Rentang tanggal');
});

test('buildPeriodRange throws on invalid date input', () => {
  assert.throws(
    () => buildPeriodRange({ mode: 'monthly', anchorDate: '2026-13-40' }),
    /Tanggal tidak valid/,
  );
});

test('buildPeriodRange throws when fromDate is after toDate', () => {
  assert.throws(
    () =>
      buildPeriodRange({
        mode: 'range',
        fromDate: '2026-04-10',
        toDate: '2026-04-01',
      }),
    /Rentang tanggal tidak valid/,
  );
});

test('buildStudentRecapRows marks missing attendance as belum_diisi', () => {
  const rows = buildStudentRecapRows({
    students: [{ id: 1, nama_siswa: 'ABC', nis: '001' }],
    sessionIds: [11, 12],
    attendanceRows: [{ session_id: 11, siswa_id: 1, status: 'H' }],
  });

  assert.equal(rows[0].hadir, 1);
  assert.equal(rows[0].belum_diisi, 1);
  assert.equal(rows[0].persentase_kehadiran, 50);
});

test('buildStudentRecapRows handles non-array attendanceRows safely', () => {
  const rows = buildStudentRecapRows({
    students: [{ id: 2, nama_siswa: 'DEF', nis: '002' }],
    sessionIds: [20],
    attendanceRows: null,
  });

  assert.equal(rows[0].hadir, 0);
  assert.equal(rows[0].belum_diisi, 1);
  assert.equal(rows[0].persentase_kehadiran, 0);
});

test('summarizeRecapRows flags not final when belum_diisi exists', () => {
  const summary = summarizeRecapRows([{ belum_diisi: 2 }, { belum_diisi: 0 }]);

  assert.equal(summary.totalBelumDiisi, 2);
  assert.equal(summary.isFinal, false);
  assert.equal(summary.statusLabel, 'Belum Final');
});

test('buildRecapExcelTableRows keeps active dataset order and values', () => {
  const tableRows = buildRecapExcelTableRows([
    {
      nama_siswa: 'Budi',
      nis: '001',
      total_pertemuan: 4,
      hadir: 3,
      sakit: 1,
      izin: 0,
      alpha: 0,
      belum_diisi: 0,
      persentase_kehadiran: 75,
    },
    {
      nama_siswa: 'Ani',
      nis: '002',
      total_pertemuan: 4,
      hadir: 2,
      sakit: 0,
      izin: 1,
      alpha: 0,
      belum_diisi: 1,
      persentase_kehadiran: 50,
    },
  ]);

  assert.deepEqual(tableRows, [
    {
      Nama: 'Budi',
      NIS: '001',
      'Total Pertemuan': 4,
      H: 3,
      S: 1,
      I: 0,
      A: 0,
      'Belum Diisi': 0,
      '% Kehadiran': 75,
    },
    {
      Nama: 'Ani',
      NIS: '002',
      'Total Pertemuan': 4,
      H: 2,
      S: 0,
      I: 1,
      A: 0,
      'Belum Diisi': 1,
      '% Kehadiran': 50,
    },
  ]);
});

test('buildRecapRequestPeriod monthly keeps anchorDate only', () => {
  const request = buildRecapRequestPeriod({
    mode: 'monthly',
    anchorDate: '2026-04-20',
    fromDate: '2026-04-01',
    toDate: '2026-04-10',
  });

  assert.equal(request.periodMode, 'monthly');
  assert.equal(request.anchorDate, '2026-04-20');
  assert.equal(request.fromDate, undefined);
  assert.equal(request.toDate, undefined);
});

test('buildRecapRequestPeriod range keeps fromDate and toDate', () => {
  const request = buildRecapRequestPeriod({
    mode: 'range',
    anchorDate: '2026-04-20',
    fromDate: '2026-04-01',
    toDate: '2026-04-10',
  });

  assert.equal(request.periodMode, 'range');
  assert.equal(request.anchorDate, undefined);
  assert.equal(request.fromDate, '2026-04-01');
  assert.equal(request.toDate, '2026-04-10');
});

test('formatRecapPeriodLabel prints human readable date range', () => {
  const label = formatRecapPeriodLabel({
    label: 'Bulanan',
    fromDate: '2026-04-01',
    toDate: '2026-04-20',
  });

  assert.equal(label, 'Bulanan: 2026-04-01 s/d 2026-04-20');
});

test('buildRecapExcelDataRows returns complete table rows with keterangan', () => {
  const rows = buildRecapExcelDataRows([
    {
      nama_siswa: 'Budi',
      nis: '001',
      total_pertemuan: 4,
      hadir: 3,
      sakit: 1,
      izin: 0,
      alpha: 0,
      belum_diisi: 0,
      persentase_kehadiran: 75,
    },
    {
      nama_siswa: 'Ani',
      nis: '002',
      total_pertemuan: 4,
      hadir: 2,
      sakit: 0,
      izin: 1,
      alpha: 0,
      belum_diisi: 1,
      persentase_kehadiran: 50,
    },
  ]);

  assert.equal(rows[0].No, 1);
  assert.equal(rows[0].Nama, 'Budi');
  assert.equal(rows[0].NIS, '001');
  assert.equal(rows[0]['Total Pertemuan'], 4);
  assert.equal(rows[0].H, 3);
  assert.equal(rows[0].S, 1);
  assert.equal(rows[0].I, 0);
  assert.equal(rows[0].A, 0);
  assert.equal(rows[0]['% Kehadiran'], 75);
  assert.equal(rows[0].Keterangan, '-');

  assert.equal(rows[1].No, 2);
  assert.equal(rows[1].Nama, 'Ani');
  assert.equal(rows[1].NIS, '002');
  assert.equal(rows[1]['Total Pertemuan'], 4);
  assert.equal(rows[1].H, 2);
  assert.equal(rows[1].S, 0);
  assert.equal(rows[1].I, 1);
  assert.equal(rows[1].A, 0);
  assert.equal(rows[1]['% Kehadiran'], 50);
  assert.equal(rows[1].Keterangan, 'Ada data yang kosong');
});
