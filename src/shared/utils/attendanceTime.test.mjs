import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatAttendanceTimeHHMM,
  getCurrentTimeHHMMWIB,
  normalizeAttendanceTimeInput,
  toAttendanceTimeForDb,
} from './attendanceTime.js';

test('normalizeAttendanceTimeInput normalizes flexible hour and minute format', () => {
  assert.equal(normalizeAttendanceTimeInput('7:5'), '07:05');
  assert.equal(normalizeAttendanceTimeInput('07:45'), '07:45');
  assert.equal(normalizeAttendanceTimeInput(' 23.59 '), '23:59');
});

test('normalizeAttendanceTimeInput rejects invalid values', () => {
  assert.equal(normalizeAttendanceTimeInput(''), null);
  assert.equal(normalizeAttendanceTimeInput('24:00'), null);
  assert.equal(normalizeAttendanceTimeInput('10:60'), null);
  assert.equal(normalizeAttendanceTimeInput('abc'), null);
  assert.equal(normalizeAttendanceTimeInput(null), null);
});

test('toAttendanceTimeForDb appends seconds and returns null for invalid value', () => {
  assert.equal(toAttendanceTimeForDb('7:30'), '07:30:00');
  assert.equal(toAttendanceTimeForDb('07:30'), '07:30:00');
  assert.equal(toAttendanceTimeForDb('invalid'), null);
});

test('formatAttendanceTimeHHMM formats database time to HH:mm', () => {
  assert.equal(formatAttendanceTimeHHMM('07:30:00'), '07:30');
  assert.equal(formatAttendanceTimeHHMM('7:30'), '07:30');
  assert.equal(formatAttendanceTimeHHMM('07.30'), '07:30');
  assert.equal(formatAttendanceTimeHHMM('invalid'), null);
  assert.equal(formatAttendanceTimeHHMM(null), null);
});

test('getCurrentTimeHHMMWIB formats provided date into WIB time', () => {
  assert.equal(getCurrentTimeHHMMWIB('2026-04-20T00:10:00Z'), '07:10');
  assert.equal(getCurrentTimeHHMMWIB('2026-04-20T17:05:00Z'), '00:05');
});

test('getCurrentTimeHHMMWIB can return custom fallback when date is invalid', () => {
  assert.equal(getCurrentTimeHHMMWIB('invalid-date', { fallback: '06:30' }), '06:30');
});

test('getCurrentTimeHHMMWIB treats null dateValue as current time source', () => {
  assert.equal(
    getCurrentTimeHHMMWIB(null, { now: '2026-04-20T03:40:00Z', fallback: '07:00' }),
    '10:40',
  );
});
