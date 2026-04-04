import test from 'node:test';
import assert from 'node:assert/strict';

import { getWorkspaceContext } from './workspaceContextRules.js';

test('route laporan pembiasaan tidak dianggap workspace pembiasaan operasional', () => {
  const context = getWorkspaceContext('/pembiasaan/laporan');
  assert.equal(context.isPembiasaanReportRoute, true);
  assert.equal(context.isPembiasaanWorkspace, false);
});

test('route operasional pembiasaan tetap dianggap workspace pembiasaan', () => {
  const context = getWorkspaceContext('/pembiasaan/sapa-pagi');
  assert.equal(context.isPembiasaanReportRoute, false);
  assert.equal(context.isPembiasaanWorkspace, true);
});
