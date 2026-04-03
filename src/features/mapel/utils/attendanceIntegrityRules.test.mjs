import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSessionClassMap,
  buildStudentClassMap,
  findFirstAttendanceClassMismatch,
} from './attendanceIntegrityRules.js';

test('buildSessionClassMap and buildStudentClassMap normalize ids', () => {
  const sessionMap = buildSessionClassMap([{ id: 'abc', schedule: { kelas_id: '10' } }]);
  const studentMap = buildStudentClassMap([{ id: 1, kelas_id: 10 }]);

  assert.equal(sessionMap.get('abc'), 10);
  assert.equal(studentMap.get('1'), 10);
});

test('findFirstAttendanceClassMismatch returns null when all entries valid', () => {
  const mismatch = findFirstAttendanceClassMismatch(
    [
      { sessionId: 's1', siswaId: 1 },
      { sessionId: 's1', siswaId: 2 },
    ],
    new Map([['s1', 10]]),
    new Map([
      ['1', 10],
      ['2', 10],
    ]),
  );

  assert.equal(mismatch, null);
});

test('findFirstAttendanceClassMismatch returns mismatch details', () => {
  const mismatch = findFirstAttendanceClassMismatch(
    [{ sessionId: 's2', siswaId: 99 }],
    new Map([['s2', 11]]),
    new Map([['99', 12]]),
  );

  assert.equal(mismatch.sessionId, 's2');
  assert.equal(mismatch.siswaId, '99');
  assert.equal(mismatch.sessionKelasId, 11);
  assert.equal(mismatch.siswaKelasId, 12);
});
