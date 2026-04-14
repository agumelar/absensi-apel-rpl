import test from 'node:test';
import assert from 'node:assert/strict';

import { buildWorkspacePortalItems } from './workspacePortalRules.js';

test('guru mapel + pembiasaan hanya melihat 2 workspace', () => {
  const items = buildWorkspacePortalItems({
    canAccessApelWorkspace: false,
    canAccessMapel: true,
    canAccessPembiasaanWorkspace: true,
  });

  assert.deepEqual(
    items.map((item) => item.key),
    ['mapel', 'pembiasaan']
  );
});

test('role executive dengan akses lengkap melihat semua workspace', () => {
  const items = buildWorkspacePortalItems({
    canAccessApelWorkspace: true,
    canAccessMapel: true,
    canAccessPembiasaanWorkspace: true,
  });

  assert.deepEqual(
    items.map((item) => item.key),
    ['apel', 'mapel', 'pembiasaan']
  );
});
