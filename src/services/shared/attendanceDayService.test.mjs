import test from 'node:test';
import assert from 'node:assert/strict';

import { ATTENDANCE_DAY_OFF_MESSAGE, getAttendanceDayStatus } from './attendanceDayService.js';

const buildSupabaseClientStub = ({ data = null, error = null, onSelect } = {}) => ({
  from(tableName) {
    assert.equal(tableName, 'school_calendar');
    return {
      select(selectClause) {
        assert.equal(selectClause, 'is_libur');
        if (onSelect) onSelect();
        return {
          eq(columnName, dateValue) {
            assert.equal(columnName, 'tanggal');
            return {
              maybeSingle: async () => ({ data, error, dateValue }),
            };
          },
        };
      },
    };
  },
});

test('getAttendanceDayStatus returns weekend as inactive without querying calendar', async () => {
  let queryCount = 0;
  const status = await getAttendanceDayStatus({
    tanggal: '2026-04-11',
    supabaseClient: buildSupabaseClientStub({ onSelect: () => (queryCount += 1) }),
  });

  assert.equal(queryCount, 0);
  assert.equal(status.isActive, false);
  assert.equal(status.reason, 'weekend');
  assert.equal(status.date, '2026-04-11');
  assert.equal(status.message, ATTENDANCE_DAY_OFF_MESSAGE);
});

test('getAttendanceDayStatus returns holiday as inactive on school_calendar libur date', async () => {
  const status = await getAttendanceDayStatus({
    tanggal: '2026-04-07',
    supabaseClient: buildSupabaseClientStub({ data: { is_libur: true } }),
  });

  assert.equal(status.isActive, false);
  assert.equal(status.reason, 'holiday');
  assert.equal(status.date, '2026-04-07');
  assert.equal(status.message, ATTENDANCE_DAY_OFF_MESSAGE);
});

test('getAttendanceDayStatus returns active when not weekend and not holiday', async () => {
  const status = await getAttendanceDayStatus({
    tanggal: '2026-04-08',
    supabaseClient: buildSupabaseClientStub({ data: { is_libur: false } }),
  });

  assert.equal(status.isActive, true);
  assert.equal(status.reason, 'active');
  assert.equal(status.date, '2026-04-08');
  assert.equal(status.message, ATTENDANCE_DAY_OFF_MESSAGE);
});

test('getAttendanceDayStatus throws when school_calendar query fails', async () => {
  await assert.rejects(
    () =>
      getAttendanceDayStatus({
        tanggal: '2026-04-08',
        supabaseClient: buildSupabaseClientStub({ error: new Error('db down') }),
      }),
    /db down/,
  );
});
