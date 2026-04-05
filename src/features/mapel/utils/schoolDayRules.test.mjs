import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSchoolHolidaySet,
  filterActiveSchoolSessionRows,
  isActiveSchoolDate,
  isBusinessWeekdayWIBDate,
} from './schoolDayRules.js';

test('isBusinessWeekdayWIBDate rejects saturday and sunday', () => {
  assert.equal(isBusinessWeekdayWIBDate('2026-04-11'), false);
  assert.equal(isBusinessWeekdayWIBDate('2026-04-12'), false);
});

test('isBusinessWeekdayWIBDate accepts monday to friday', () => {
  assert.equal(isBusinessWeekdayWIBDate('2026-04-06'), true);
  assert.equal(isBusinessWeekdayWIBDate('2026-04-10'), true);
});

test('buildSchoolHolidaySet keeps only rows marked as is_libur', () => {
  const result = buildSchoolHolidaySet([
    { tanggal: '2026-04-07', is_libur: true },
    { tanggal: '2026-04-08', is_libur: false },
    { tanggal: '2026-04-09', is_libur: true },
  ]);

  assert.equal(result.has('2026-04-07'), true);
  assert.equal(result.has('2026-04-08'), false);
  assert.equal(result.has('2026-04-09'), true);
});

test('isActiveSchoolDate excludes weekend and holiday dates', () => {
  const holidaySet = new Set(['2026-04-07']);
  assert.equal(isActiveSchoolDate('2026-04-07', holidaySet), false);
  assert.equal(isActiveSchoolDate('2026-04-11', holidaySet), false);
  assert.equal(isActiveSchoolDate('2026-04-08', holidaySet), true);
});

test('filterActiveSchoolSessionRows keeps only active-school sessions', () => {
  const sessionRows = [
    { id: 1, tanggal: '2026-04-06' },
    { id: 2, tanggal: '2026-04-07' },
    { id: 3, tanggal: '2026-04-11' },
  ];
  const holidaySet = new Set(['2026-04-07']);

  const result = filterActiveSchoolSessionRows(sessionRows, holidaySet);
  assert.deepEqual(
    result.map((row) => row.id),
    [1],
  );
});

test('isActiveSchoolDate returns false for empty date', () => {
  assert.equal(isActiveSchoolDate('', new Set()), false);
});
