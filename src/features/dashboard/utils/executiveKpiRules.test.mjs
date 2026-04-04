import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildImpactedClassBuckets,
  buildTrendBuckets,
  computeSlaBreach,
  computeTeacherRates,
} from './executiveKpiRules.js';

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
