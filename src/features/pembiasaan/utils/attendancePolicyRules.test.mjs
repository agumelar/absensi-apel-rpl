import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getEvidencePolicyByStatus,
  isBusinessWeekdayWIBDate,
  shouldValidateSchoolRadius,
} from './attendancePolicyRules.js';

test('getEvidencePolicyByStatus enforces GPS and photo for hadir', () => {
  const policy = getEvidencePolicyByStatus('hadir');
  assert.equal(policy.requireLocation, true);
  assert.equal(policy.requirePhoto, true);
  assert.equal(policy.requireNote, false);
});

test('getEvidencePolicyByStatus enforces note-only for izin and sakit', () => {
  const izin = getEvidencePolicyByStatus('izin');
  const sakit = getEvidencePolicyByStatus('sakit');

  assert.deepEqual(izin, {
    requireLocation: false,
    requirePhoto: false,
    requireNote: true,
  });

  assert.deepEqual(sakit, {
    requireLocation: false,
    requirePhoto: false,
    requireNote: true,
  });
});

test('shouldValidateSchoolRadius only true for hadir', () => {
  assert.equal(shouldValidateSchoolRadius('hadir'), true);
  assert.equal(shouldValidateSchoolRadius('izin'), false);
  assert.equal(shouldValidateSchoolRadius('sakit'), false);
});

test('isBusinessWeekdayWIBDate rejects saturday and sunday', () => {
  assert.equal(isBusinessWeekdayWIBDate('2026-04-04'), false);
  assert.equal(isBusinessWeekdayWIBDate('2026-04-05'), false);
});

test('isBusinessWeekdayWIBDate accepts monday to friday', () => {
  assert.equal(isBusinessWeekdayWIBDate('2026-04-06'), true);
  assert.equal(isBusinessWeekdayWIBDate('2026-04-07'), true);
  assert.equal(isBusinessWeekdayWIBDate('2026-04-10'), true);
});
