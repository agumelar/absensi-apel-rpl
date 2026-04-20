import test from 'node:test';
import assert from 'node:assert/strict';

import { isJurusanScopedExecutiveReportRole } from './executivePembiasaanScopeRules.js';

test('kaprog follows kepsek scope on pembiasaan report', () => {
  assert.equal(isJurusanScopedExecutiveReportRole('kaprog'), false);
  assert.equal(isJurusanScopedExecutiveReportRole('kepsek'), false);
});

test('executive roles stay global by default for pembiasaan report', () => {
  assert.equal(isJurusanScopedExecutiveReportRole('kesiswaan'), false);
  assert.equal(isJurusanScopedExecutiveReportRole('kurikulum'), false);
});
