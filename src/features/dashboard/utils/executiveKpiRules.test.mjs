import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAPEL_PERFORMANCE_START_DATE,
  buildExpectedScheduleOccurrences,
  buildImpactedClassBuckets,
  buildTrendBuckets,
  computeSlaBreach,
  computeTeacherAttentionScore,
  computeTeacherRates,
  resolvePerformancePeriodStart,
} from './executiveKpiRules.js';

test('resolvePerformancePeriodStart clamps July 2026 to official monitoring start', () => {
  assert.equal(MAPEL_PERFORMANCE_START_DATE, '2026-07-20');
  assert.equal(resolvePerformancePeriodStart('2026-07-01'), '2026-07-20');
  assert.equal(resolvePerformancePeriodStart('2026-07-20'), '2026-07-20');
});

test('resolvePerformancePeriodStart keeps first day for months after cutover', () => {
  assert.equal(resolvePerformancePeriodStart('2026-08-01'), '2026-08-01');
  assert.equal(resolvePerformancePeriodStart('2026-09-01'), '2026-09-01');
});

test('computeTeacherRates returns presence/late/tidakMasuk percentage', () => {
  const result = computeTeacherRates({
    totalScheduled: 10,
    totalHadir: 7,
    totalTidakMasuk: 2,
    totalLate: 3,
  });

  assert.equal(result.presenceRate, 70);
  assert.equal(result.tidakMasukRate, 20);
  assert.equal(result.lateRate, 42.9);
});

test('computeSlaBreach marks breach after minute-16', () => {
  const result = computeSlaBreach({
    startMinutes: 420,
    nowMinutes: 436,
    hasCheckIn: false,
  });

  assert.equal(result.isBreach, true);
});

test('buildImpactedClassBuckets counts distinct kelas per day', () => {
  const buckets = buildImpactedClassBuckets([
    { tanggal: '2026-04-04', kelas_id: 1, breached: true },
    { tanggal: '2026-04-04', kelas_id: 1, breached: true },
    { tanggal: '2026-04-04', kelas_id: 2, breached: true },
    { tanggal: '2026-04-05', kelas_id: 3, breached: false },
  ]);

  assert.equal(buckets[0].impactedClasses, 2);
  assert.equal(buckets[1].impactedClasses, 0);
});

test('buildTrendBuckets groups by day and dimension', () => {
  const rows = buildTrendBuckets(
    [
      { tanggal: '2026-04-04', guru: 'A', statusNorm: 'hadir', isLate: false },
      { tanggal: '2026-04-04', guru: 'A', statusNorm: 'tidak masuk', isLate: false },
      { tanggal: '2026-04-04', guru: 'A', statusNorm: 'hadir', isLate: true },
    ],
    'guru',
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0].total, 3);
  assert.equal(rows[0].hadir, 2);
  assert.equal(rows[0].tidakMasuk, 1);
  assert.equal(rows[0].late, 1);
});

test('buildTrendBuckets changes grouping when dimension changes', () => {
  const sampleRows = [
    { tanggal: '2026-04-04', guru_nama: 'Guru A', kelas_nama: 'X RPL 1', mapel_nama: 'RPL', statusNorm: 'hadir', isLate: false },
    { tanggal: '2026-04-04', guru_nama: 'Guru A', kelas_nama: 'X RPL 2', mapel_nama: 'RPL', statusNorm: 'hadir', isLate: true },
  ];

  const byGuru = buildTrendBuckets(sampleRows, 'guru_nama');
  const byKelas = buildTrendBuckets(sampleRows, 'kelas_nama');

  assert.equal(byGuru.length, 1);
  assert.equal(byKelas.length, 2);
});

test('buildExpectedScheduleOccurrences creates missed attendance for elapsed schedule without session', () => {
  const rows = buildExpectedScheduleOccurrences({
    schedules: [
      { id: 1, hari: 'Senin', jam_mulai: '07:00', jam_selesai: '08:30' },
    ],
    sessions: [],
    fromDate: '2026-07-20',
    toDate: '2026-07-20',
    todayDate: '2026-07-21',
    nowMinutes: 600,
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].is_virtual, true);
  assert.equal(rows[0].statusNorm, 'tidak masuk');
  assert.equal(rows[0].attentionType, 'lupa_absen');
  assert.equal(rows[0].statusLabel, 'Lupa Absen / Tidak Absen');
});

test('buildExpectedScheduleOccurrences excludes future and holiday schedule slots', () => {
  const rows = buildExpectedScheduleOccurrences({
    schedules: [
      { id: 1, hari: 'Senin', jam_mulai: '13:00', jam_selesai: '14:00' },
      { id: 2, hari: 'Selasa', jam_mulai: '07:00', jam_selesai: '08:00' },
    ],
    sessions: [],
    fromDate: '2026-07-20',
    toDate: '2026-07-21',
    holidaySet: new Set(['2026-07-21']),
    todayDate: '2026-07-20',
    nowMinutes: 600,
  });

  assert.equal(rows.length, 0);
});

test('buildExpectedScheduleOccurrences excludes weekend schedule slots', () => {
  const rows = buildExpectedScheduleOccurrences({
    schedules: [
      { id: 1, hari: 'Sabtu', jam_mulai: '07:00', jam_selesai: '08:00' },
    ],
    sessions: [
      {
        id: 'weekend-session',
        schedule_id: 1,
        tanggal: '2026-07-18',
        status: 'Hadir',
        waktu_check_in: '2026-07-18T07:00:00+07:00',
      },
    ],
    fromDate: '2026-07-18',
    toDate: '2026-07-18',
    todayDate: '2026-07-19',
    nowMinutes: 600,
  });

  assert.equal(rows.length, 0);
});

test('buildExpectedScheduleOccurrences distinguishes late check-in and missing checkout', () => {
  const rows = buildExpectedScheduleOccurrences({
    schedules: [
      { id: 'sch-1', hari: 'Senin', jam_mulai: '07:00', jam_selesai: '08:30' },
      { id: 'sch-2', hari: 'Senin', jam_mulai: '09:00', jam_selesai: '10:00' },
    ],
    sessions: [
      {
        id: 'ses-1',
        schedule_id: 'sch-1',
        tanggal: '2026-07-20',
        status: 'Hadir',
        waktu_check_in: '2026-07-20T07:20:00+07:00',
        waktu_check_out: '2026-07-20T08:31:00+07:00',
      },
      {
        id: 'ses-2',
        schedule_id: 'sch-2',
        tanggal: '2026-07-20',
        status: 'Hadir',
        waktu_check_in: '2026-07-20T09:00:00+07:00',
        waktu_check_out: null,
      },
    ],
    fromDate: '2026-07-20',
    toDate: '2026-07-20',
    todayDate: '2026-07-21',
    nowMinutes: 600,
  });

  assert.equal(rows.length, 2);
  assert.equal(rows.find((row) => row.occurrence_id === 'ses-1').isLate, true);
  assert.equal(rows.find((row) => row.occurrence_id === 'ses-2').attentionType, 'missing_checkout');
});

test('buildExpectedScheduleOccurrences preserves confirmed teacher absence', () => {
  const rows = buildExpectedScheduleOccurrences({
    schedules: [
      { id: 'sch-1', hari: 'Senin', jam_mulai: '07:00', jam_selesai: '08:30' },
    ],
    sessions: [
      {
        id: 'ses-1',
        schedule_id: 'sch-1',
        tanggal: '2026-07-20',
        status: 'Tidak Masuk',
      },
    ],
    fromDate: '2026-07-20',
    toDate: '2026-07-20',
    todayDate: '2026-07-21',
    nowMinutes: 600,
  });

  assert.equal(rows[0].statusNorm, 'tidak masuk');
  assert.equal(rows[0].attentionType, 'confirmed_absence');
  assert.equal(rows[0].is_virtual, false);
});

test('computeTeacherAttentionScore prioritizes forgotten attendance', () => {
  assert.equal(
    computeTeacherAttentionScore({
      lupaAbsen: 2,
      confirmedAbsence: 1,
      late: 3,
      missingCheckOut: 2,
      slaBreach: 1,
    }),
    21,
  );
});
