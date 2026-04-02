import test from 'node:test';
import assert from 'node:assert/strict';

import {
  canCheckOutSession,
  getAttendanceProgressState,
  getPhotoActionLabel,
} from './sessionWorkflowRules.js';

test('canCheckOutSession returns true when all requirements are met', () => {
  const result = canCheckOutSession({
    hasSchedule: true,
    hasSession: true,
    hasCheckIn: true,
    hasAgendaSubmitted: true,
    attendanceCompletionRatio: 1,
  });

  assert.equal(result.allowed, true);
  assert.equal(result.reason, null);
});

test('canCheckOutSession blocks when check-in has not been done', () => {
  const result = canCheckOutSession({
    hasSchedule: true,
    hasSession: true,
    hasCheckIn: false,
    hasAgendaSubmitted: true,
    attendanceCompletionRatio: 1,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'check_in_required');
});

test('canCheckOutSession blocks when attendance is below threshold', () => {
  const result = canCheckOutSession({
    hasSchedule: true,
    hasSession: true,
    hasCheckIn: true,
    hasAgendaSubmitted: true,
    attendanceCompletionRatio: 0.89,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'attendance_not_ready');
});

test('getAttendanceProgressState uses threshold 90% as completed', () => {
  const state = getAttendanceProgressState({ filled: 9, total: 10, doneThreshold: 0.9 });
  assert.equal(state.status, 'completed');
  assert.equal(state.ratio, 0.9);
});

test('getAttendanceProgressState marks in progress below threshold', () => {
  const state = getAttendanceProgressState({ filled: 5, total: 10, doneThreshold: 0.9 });
  assert.equal(state.status, 'in_progress');
  assert.equal(state.ratio, 0.5);
});

test('getPhotoActionLabel returns "Lihat Foto" after photo exists', () => {
  assert.equal(getPhotoActionLabel({ hasPhoto: true, defaultLabel: 'Check-In Foto' }), 'Lihat Foto');
  assert.equal(getPhotoActionLabel({ hasPhoto: false, defaultLabel: 'Check-In Foto' }), 'Check-In Foto');
});
