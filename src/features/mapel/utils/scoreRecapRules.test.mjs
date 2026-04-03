import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPeriodRange,
  buildRecapRequestPeriod,
  buildScoreRecapExcelDataRows,
  buildScoreRecapRows,
  formatRecapPeriodLabel,
  summarizeScoreRecapRows,
} from './scoreRecapRules.js';

test('buildPeriodRange monthly returns first day to selected day', () => {
  const range = buildPeriodRange({ mode: 'monthly', anchorDate: '2026-04-15' });

  assert.equal(range.fromDate, '2026-04-01');
  assert.equal(range.toDate, '2026-04-15');
});

test('buildPeriodRange range validates date order', () => {
  assert.throws(
    () => buildPeriodRange({ mode: 'range', fromDate: '2026-04-10', toDate: '2026-04-01' }),
    /Rentang tanggal tidak valid/,
  );
});

test('buildScoreRecapRows computes bonus recap without penalizing missing scores', () => {
  const rows = buildScoreRecapRows({
    students: [
      { id: 1, nama_siswa: 'Siswa A', nis: '001' },
      { id: 2, nama_siswa: 'Siswa B', nis: '002' },
      { id: 3, nama_siswa: 'Siswa C', nis: '003' },
    ],
    sessionIds: [10, 11, 12],
    scoreRows: [
      { session_id: 10, siswa_id: 1, nilai: 90 },
      { session_id: 11, siswa_id: 1, nilai: 80 },
      { session_id: 12, siswa_id: 1, nilai: 85 },
      { session_id: 11, siswa_id: 2, nilai: 88 },
    ],
  });

  assert.equal(rows[0].frekuensi_dinilai, 3);
  assert.equal(rows[0].coverage_persen, 100);
  assert.equal(rows[0].total_poin, 255);
  assert.equal(rows[0].rata_rata_saat_dinilai, 85);
  assert.equal(rows[0].keterangan, 'Sudah pernah dinilai');

  assert.equal(rows[1].frekuensi_dinilai, 1);
  assert.equal(rows[1].coverage_persen, 33.3);
  assert.equal(rows[1].total_poin, 88);
  assert.equal(rows[1].rata_rata_saat_dinilai, 88);

  assert.equal(rows[2].frekuensi_dinilai, 0);
  assert.equal(rows[2].coverage_persen, 0);
  assert.equal(rows[2].total_poin, 0);
  assert.equal(rows[2].rata_rata_saat_dinilai, null);
  assert.equal(rows[2].keterangan, 'Belum pernah dinilai');
});

test('summarizeScoreRecapRows returns recap-level statistics', () => {
  const summary = summarizeScoreRecapRows([
    { frekuensi_dinilai: 2, coverage_persen: 100 },
    { frekuensi_dinilai: 1, coverage_persen: 50 },
    { frekuensi_dinilai: 0, coverage_persen: 0 },
  ]);

  assert.equal(summary.totalSiswa, 3);
  assert.equal(summary.siswaDinilai, 2);
  assert.equal(summary.siswaBelumDinilai, 1);
  assert.equal(summary.rataRataCoverage, 50);
});

test('buildScoreRecapExcelDataRows maps recap rows into stable excel table', () => {
  const rows = buildScoreRecapExcelDataRows([
    {
      nama_siswa: 'Siswa C',
      nis: '003',
      total_pertemuan: 3,
      frekuensi_dinilai: 0,
      coverage_persen: 0,
      total_poin: 0,
      rata_rata_saat_dinilai: null,
      keterangan: 'Belum pernah dinilai',
    },
  ]);

  assert.equal(rows[0].No, 1);
  assert.equal(rows[0].Nama, 'Siswa C');
  assert.equal(rows[0].NIS, '003');
  assert.equal(rows[0]['Total Pertemuan'], 3);
  assert.equal(rows[0]['Frekuensi Dinilai'], 0);
  assert.equal(rows[0]['Cakupan Penilaian (%)'], 0);
  assert.equal(rows[0]['Total Poin'], 0);
  assert.equal(rows[0]['Rata-rata Saat Diberi Nilai'], '-');
  assert.equal(rows[0].Keterangan, 'Belum pernah dinilai');
});

test('buildRecapRequestPeriod range keeps fromDate and toDate', () => {
  const request = buildRecapRequestPeriod({
    mode: 'range',
    fromDate: '2026-04-01',
    toDate: '2026-04-10',
    anchorDate: '2026-04-20',
  });

  assert.equal(request.periodMode, 'range');
  assert.equal(request.fromDate, '2026-04-01');
  assert.equal(request.toDate, '2026-04-10');
  assert.equal(request.anchorDate, undefined);
});

test('formatRecapPeriodLabel renders readable label', () => {
  const label = formatRecapPeriodLabel({
    label: 'Bulanan',
    fromDate: '2026-04-01',
    toDate: '2026-04-20',
  });

  assert.equal(label, 'Bulanan: 2026-04-01 s/d 2026-04-20');
});
