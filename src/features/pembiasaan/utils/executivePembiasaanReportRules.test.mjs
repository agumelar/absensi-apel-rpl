import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDailyMonitoringRows, buildTeacherRecapRows } from './executivePembiasaanReportRules.js';

test('buildDailyMonitoringRows keeps selected date and status', () => {
  const rows = [
    { id: '1', tanggal: '2026-04-06', nama_lengkap: 'Budi', status: 'hadir', checkin_at: '2026-04-06T06:10:00.000Z' },
    { id: '2', tanggal: '2026-04-06', nama_lengkap: 'Andi', status: 'izin', checkin_at: null },
    { id: '3', tanggal: '2026-04-07', nama_lengkap: 'Citra', status: 'hadir', checkin_at: '2026-04-07T06:00:00.000Z' },
  ];

  const result = buildDailyMonitoringRows(rows, { focusDate: '2026-04-06', status: 'izin' });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, '2');
});

test('buildDailyMonitoringRows sorts checkin first then name', () => {
  const rows = [
    { id: '1', tanggal: '2026-04-06', nama_lengkap: 'Citra', status: 'hadir', checkin_at: null },
    { id: '2', tanggal: '2026-04-06', nama_lengkap: 'Budi', status: 'hadir', checkin_at: '2026-04-06T06:20:00.000Z' },
    { id: '3', tanggal: '2026-04-06', nama_lengkap: 'Andi', status: 'hadir', checkin_at: '2026-04-06T06:10:00.000Z' },
  ];

  const result = buildDailyMonitoringRows(rows, { focusDate: '2026-04-06', status: 'all' });
  assert.deepEqual(
    result.map((row) => row.id),
    ['3', '2', '1'],
  );
});

test('buildTeacherRecapRows computes aktual, kewajiban and kepatuhan', () => {
  const rows = [
    { user_id: 'u1', nama_lengkap: 'Guru A', status: 'hadir' },
    { user_id: 'u1', nama_lengkap: 'Guru A', status: 'alpha' },
    { user_id: 'u2', nama_lengkap: 'Guru B', status: 'izin' },
  ];

  const participants = [
    { id: 'u1', nama_lengkap: 'Guru A' },
    { id: 'u2', nama_lengkap: 'Guru B' },
    { id: 'u3', nama_lengkap: 'Guru C' },
  ];

  const obligationsByUserId = { u1: 4, u2: 2, u3: 3 };

  const result = buildTeacherRecapRows({ rows, participants, obligationsByUserId });
  const guruA = result.find((item) => item.user_id === 'u1');
  const guruC = result.find((item) => item.user_id === 'u3');

  assert.equal(guruA.total_aktual, 2);
  assert.equal(guruA.total_kewajiban, 4);
  assert.equal(guruA.kepatuhan_persen, 50);
  assert.equal(guruC.total_aktual, 0);
  assert.equal(guruC.total_kewajiban, 3);
});
