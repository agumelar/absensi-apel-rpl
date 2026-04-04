import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildMonthRangeByOffset,
  buildSessionHistoryExcelRows,
  resolveTaskDeliverySummary,
  toLocalTimeLabel,
} from './sessionHistoryRules.js';

test('buildMonthRangeByOffset returns full current month range', () => {
  const range = buildMonthRangeByOffset('2026-04-15', 0);

  assert.equal(range.fromDate, '2026-04-01');
  assert.equal(range.toDate, '2026-04-30');
});

test('buildMonthRangeByOffset supports previous month', () => {
  const range = buildMonthRangeByOffset('2026-04-15', -1);

  assert.equal(range.fromDate, '2026-03-01');
  assert.equal(range.toDate, '2026-03-31');
});

test('toLocalTimeLabel converts ISO string into readable time', () => {
  const label = toLocalTimeLabel('2026-04-02T01:10:00.000Z');

  assert.match(label, /^\d{2}:\d{2}$/);
});

test('buildSessionHistoryExcelRows maps rows with topik and metode columns', () => {
  const rows = buildSessionHistoryExcelRows([
    {
      tanggal: '2026-04-03',
      status: 'hadir',
      waktu_check_in: '2026-04-03T00:00:00.000Z',
      waktu_check_out: '2026-04-03T01:00:00.000Z',
      schedule: {
        master_kelas: { nama_kelas: 'X RPL 1' },
        master_mapel: { nama_mapel: 'Pemrograman Dasar' },
      },
      student_attendance_mapel: [
        { status: 'H' },
        { status: 'HADIR' },
        { status: 'S' },
        { status: 'IZIN' },
        { status: 'ALPHA' },
      ],
      class_agenda: [{ topik: 'Perulangan', metode: 'Diskusi' }],
    },
  ]);

  assert.equal(rows[0].No, 1);
  assert.equal(rows[0].Tanggal, '2026-04-03');
  assert.equal(rows[0].Kelas, 'X RPL 1');
  assert.equal(rows[0].Mapel, 'Pemrograman Dasar');
  assert.equal(rows[0].Topik, 'Perulangan');
  assert.equal(rows[0].Metode, 'Diskusi');
  assert.equal(rows[0].H, 2);
  assert.equal(rows[0].S, 1);
  assert.equal(rows[0].I, 1);
  assert.equal(rows[0].A, 1);
  assert.equal(rows[0].Status, 'hadir');
  assert.equal(rows[0]['Status Distribusi Tugas'], '-');
  assert.equal(rows[0]['Waktu Distribusi'], '-');
});

test('resolveTaskDeliverySummary returns pending label when task exists but not delivered', () => {
  const summary = resolveTaskDeliverySummary({
    teacher_absence_task: [{ id: 10, delivered_by_picket: false, delivered_at: null }],
  });

  assert.equal(summary.taskId, 10);
  assert.equal(summary.deliveryStatusLabel, 'Menunggu Distribusi');
  assert.equal(summary.deliveryTimeLabel, '-');
});

test('resolveTaskDeliverySummary returns delivered label and time when task delivered', () => {
  const summary = resolveTaskDeliverySummary({
    teacher_absence_task: [{ id: 11, delivered_by_picket: true, delivered_at: '2026-04-03T01:00:00.000Z' }],
  });

  assert.equal(summary.taskId, 11);
  assert.equal(summary.deliveryStatusLabel, 'Sudah Didistribusikan');
  assert.match(summary.deliveryTimeLabel, /^\d{2}:\d{2}$/);
});
