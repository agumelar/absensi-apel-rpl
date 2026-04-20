import test from 'node:test';
import assert from 'node:assert/strict';

import useUserRoleFlags from './useUserRoleFlags.js';
import { APP_SWITCHER_ROUTE } from '../../shared/constants/routes.js';

test('guru_mapel tunggal dapat akses pembiasaan', () => {
  const flags = useUserRoleFlags({
    role: 'guru_mapel',
    is_guru_mapel: true,
  });

  assert.equal(flags.canAccessPembiasaanWorkspace, true);
});

test('guru mapel tanpa apel masuk mode multi-workspace mapel+pembiasaan', () => {
  const flags = useUserRoleFlags({
    role: 'guru',
    is_guru_mapel: true,
  });

  assert.equal(flags.canAccessApelWorkspace, false);
  assert.equal(flags.canAccessMapel, true);
  assert.equal(flags.canAccessPembiasaanWorkspace, true);
  assert.equal(flags.hasMultiWorkspace, true);
  assert.equal(flags.dashboardLink, APP_SWITCHER_ROUTE);
});

test('kaprog can view pembiasaan report like kepsek', () => {
  const flagsKaprog = useUserRoleFlags({ role: 'kaprog' });
  const flagsKepsek = useUserRoleFlags({ role: 'kepsek' });

  assert.equal(flagsKaprog.canViewPembiasaanReport, true);
  assert.equal(flagsKepsek.canViewPembiasaanReport, true);
});
