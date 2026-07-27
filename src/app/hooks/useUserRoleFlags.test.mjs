import test from 'node:test';
import assert from 'node:assert/strict';

import useUserRoleFlags from './useUserRoleFlags.js';
import { isPembiasaanAttendanceRole } from '../../shared/constants/roles.js';
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

test('admin, kepsek, dan piket tetap dapat mengakses workspace pembiasaan untuk pengawasan', () => {
  ['admin', 'kepsek', 'piket'].forEach((role) => {
    const flags = useUserRoleFlags({ role });
    assert.equal(flags.canAccessPembiasaanWorkspace, true, `${role} harus dapat akses pembiasaan`);
    assert.equal(flags.canParticipatePembiasaanAttendance, false, `${role} tidak boleh masuk kegiatan absen`);
  });
});

test('admin, kepsek, dan piket tidak menjadi peserta absensi pembiasaan', () => {
  ['admin', 'kepsek', 'piket'].forEach((role) => {
    assert.equal(isPembiasaanAttendanceRole(role), false);
  });
  ['guru', 'guru_mapel', 'tu', 'kesiswaan', 'kaprog', 'kurikulum', 'walikelas', 'walas'].forEach((role) => {
    assert.equal(isPembiasaanAttendanceRole(role), true);
    assert.equal(useUserRoleFlags({ role }).canParticipatePembiasaanAttendance, true);
  });
});
