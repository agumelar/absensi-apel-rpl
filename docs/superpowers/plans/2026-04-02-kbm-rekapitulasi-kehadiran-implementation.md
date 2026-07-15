# KBM Rekapitulasi Kehadiran Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menyediakan halaman `Rekapitulasi KBM` khusus workspace mapel yang menampilkan ringkasan kehadiran per siswa (H/S/I/A/Belum diisi/%), mendukung filter kelas-mapel-periode, perbaikan data bolong, dan export Excel sesuai tampilan.

**Architecture:** Implementasi memakai pendekatan on-demand: UI mengirim filter ke service mapel, service mengambil sesi+absensi+siswa aktif lalu menghitung agregasi rekap di service layer. Halaman rekap menjadi consumer tunggal untuk dataset itu, dan export Excel menggunakan dataset aktif yang sama agar konsisten 1:1.

**Tech Stack:** React 19, React Router 7, Supabase JS, SweetAlert2, ExcelJS (via `exportJsonToExcel`), Node test runner (`node --test`).

---

## File Structure (Locked)

- Create: `src/features/mapel/utils/attendanceRecapRules.js`
  - Pure functions untuk kalkulasi periode, agregasi H/S/I/A/Belum diisi, persentase, dan status finalitas.
- Create: `src/features/mapel/utils/attendanceRecapRules.test.mjs`
  - Unit test aturan rekap agar perubahan perilaku terjaga.
- Create: `src/features/mapel/pages/MapelAttendanceRecapPage.jsx`
  - Halaman baru rekapitulasi KBM + filter + tabel + tombol perbaikan data bolong + export.
- Modify: `src/shared/constants/routes.js`
  - Tambah konstanta route rekap mapel.
- Modify: `src/routes/AppRoutes.jsx`
  - Registrasi route baru dengan guard `canAccessMapel`.
- Modify: `src/app/AppShell.jsx`
  - Tambah item sidebar `Rekapitulasi KBM` di modul mapel saja.
- Modify: `src/features/mapel/pages/MapelHomePage.jsx`
  - Tambah shortcut ke halaman rekap.
- Modify: `src/services/mapelService.js`
  - Tambah service filter options rekap, query rekap on-demand, dan service patch data bolong.
- Modify: `package.json`
  - Masukkan file test baru ke script `test:unit`.
- Modify: `v2-log.md`
  - Catat status implemented saat selesai.

### Task 1: Build Attendance Recap Rules (Pure Functions + Tests)

**Files:**
- Create: `src/features/mapel/utils/attendanceRecapRules.js`
- Create: `src/features/mapel/utils/attendanceRecapRules.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write failing tests for aggregation and period handling**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPeriodRange,
  buildStudentRecapRows,
  summarizeRecapRows,
} from './attendanceRecapRules.js';

test('buildPeriodRange monthly returns first day to selected day', () => {
  const range = buildPeriodRange({ mode: 'monthly', anchorDate: '2026-04-15' });
  assert.equal(range.fromDate, '2026-04-01');
  assert.equal(range.toDate, '2026-04-15');
});

test('buildStudentRecapRows marks missing attendance as belum_diisi', () => {
  const rows = buildStudentRecapRows({
    students: [{ id: 1, nama_siswa: 'ABC', nis: '001' }],
    sessionIds: [11, 12],
    attendanceRows: [{ session_id: 11, siswa_id: 1, status: 'H' }],
  });
  assert.equal(rows[0].hadir, 1);
  assert.equal(rows[0].belum_diisi, 1);
  assert.equal(rows[0].persentase_kehadiran, 50);
});

test('summarizeRecapRows flags not final when belum_diisi exists', () => {
  const meta = summarizeRecapRows([{ belum_diisi: 2 }, { belum_diisi: 0 }]);
  assert.equal(meta.isFinal, false);
  assert.equal(meta.statusLabel, 'Belum Final');
});
```

- [ ] **Step 2: Run tests to confirm RED state**

Run: `node --test src/features/mapel/utils/attendanceRecapRules.test.mjs`
Expected: FAIL with module not found for `attendanceRecapRules.js`.

- [ ] **Step 3: Implement minimal rules to pass tests**

```js
const toDateOnly = (value) => String(value || '').slice(0, 10);

export const buildPeriodRange = ({ mode, anchorDate, fromDate, toDate }) => {
  if (mode === 'today') {
    const day = toDateOnly(anchorDate);
    return { fromDate: day, toDate: day, label: 'Hari ini' };
  }
  if (mode === 'range') {
    if (!fromDate || !toDate || fromDate > toDate) {
      throw new Error('Rentang tanggal tidak valid.');
    }
    return { fromDate: toDateOnly(fromDate), toDate: toDateOnly(toDate), label: 'Rentang tanggal' };
  }
  const day = toDateOnly(anchorDate);
  const monthStart = `${day.slice(0, 8)}01`;
  return { fromDate: monthStart, toDate: day, label: 'Bulanan' };
};

const normalizeStatus = (status) => {
  const value = String(status || '').trim().toUpperCase();
  if (value === 'HADIR' || value === 'H') return 'H';
  if (value === 'SAKIT' || value === 'S') return 'S';
  if (value === 'IZIN' || value === 'I') return 'I';
  if (value === 'ALPHA' || value === 'A') return 'A';
  return null;
};

export const buildStudentRecapRows = ({ students, sessionIds, attendanceRows }) => {
  const safeSessions = Array.isArray(sessionIds) ? sessionIds : [];
  const totalPertemuan = safeSessions.length;
  const attendanceMap = new Map();

  (attendanceRows || []).forEach((row) => {
    const key = `${row.session_id}:${row.siswa_id}`;
    attendanceMap.set(key, normalizeStatus(row.status));
  });

  return (students || []).map((student) => {
    const recap = {
      siswa_id: student.id,
      nama_siswa: student.nama_siswa || '-',
      nis: student.nis || '-',
      total_pertemuan: totalPertemuan,
      hadir: 0,
      sakit: 0,
      izin: 0,
      alpha: 0,
      belum_diisi: 0,
      persentase_kehadiran: 0,
    };

    safeSessions.forEach((sessionId) => {
      const status = attendanceMap.get(`${sessionId}:${student.id}`);
      if (status === 'H') recap.hadir += 1;
      else if (status === 'S') recap.sakit += 1;
      else if (status === 'I') recap.izin += 1;
      else if (status === 'A') recap.alpha += 1;
      else recap.belum_diisi += 1;
    });

    recap.persentase_kehadiran = totalPertemuan > 0 ? Math.round((recap.hadir / totalPertemuan) * 1000) / 10 : 0;
    return recap;
  });
};

export const summarizeRecapRows = (rows) => {
  const totalBelumDiisi = (rows || []).reduce((sum, row) => sum + Number(row.belum_diisi || 0), 0);
  return {
    totalBelumDiisi,
    isFinal: totalBelumDiisi === 0,
    statusLabel: totalBelumDiisi === 0 ? 'Final' : 'Belum Final',
  };
};
```

- [ ] **Step 4: Update `test:unit` script to include recap rules tests**

```json
{
  "scripts": {
    "test:unit": "node --test src/shared/utils/compressionPolicy.test.mjs src/features/mapel/utils/sessionWorkflowRules.test.mjs src/features/mapel/utils/attendanceRecapRules.test.mjs"
  }
}
```

- [ ] **Step 5: Run unit tests (GREEN)**

Run: `npm run test:unit`
Expected: PASS for recap rules tests and existing tests.

- [ ] **Step 6: Commit task 1**

```bash
git add src/features/mapel/utils/attendanceRecapRules.js src/features/mapel/utils/attendanceRecapRules.test.mjs package.json
git commit -m "test: add attendance recap aggregation rules"
```

### Task 2: Add Rekap Service APIs (Filter, Aggregation, Backfill)

**Files:**
- Modify: `src/services/mapelService.js`
- Test: `src/features/mapel/utils/attendanceRecapRules.test.mjs`

- [ ] **Step 1: Write failing unit test for period validation edge case**

```js
test('buildPeriodRange throws when range is invalid', () => {
  assert.throws(
    () => buildPeriodRange({ mode: 'range', fromDate: '2026-04-10', toDate: '2026-04-01' }),
    /Rentang tanggal tidak valid/,
  );
});
```

- [ ] **Step 2: Run test to verify RED**

Run: `npm run test:unit`
Expected: FAIL until validation test and implementation align.

- [ ] **Step 3: Implement mapel recap service functions**

```js
// Tambahkan import helper
import {
  buildPeriodRange,
  buildStudentRecapRows,
  summarizeRecapRows,
} from '../features/mapel/utils/attendanceRecapRules';

export const fetchMapelRecapFilterOptions = async ({ guruId } = {}) => {
  assertRequired('guruId', guruId);
  const { data: scheduleRows, error: scheduleError } = await supabase
    .from('schedule')
    .select('kelas_id, mapel_id, master_kelas(nama_kelas), master_mapel(nama_mapel, kode_mapel)')
    .eq('guru_id', guruId);
  if (scheduleError) throw scheduleError;

  // Dedup kelas/mapel dari jadwal guru
  const kelasMap = new Map();
  const mapelMap = new Map();
  (scheduleRows || []).forEach((row) => {
    if (row.kelas_id) kelasMap.set(String(row.kelas_id), { id: row.kelas_id, nama_kelas: row.master_kelas?.nama_kelas || '-' });
    if (row.mapel_id) {
      mapelMap.set(String(row.mapel_id), {
        id: row.mapel_id,
        nama_mapel: row.master_mapel?.nama_mapel || '-',
        kode_mapel: row.master_mapel?.kode_mapel || '-',
      });
    }
  });

  return {
    kelasOptions: [...kelasMap.values()].sort((a, b) => String(a.nama_kelas).localeCompare(String(b.nama_kelas))),
    mapelOptions: [...mapelMap.values()].sort((a, b) => String(a.nama_mapel).localeCompare(String(b.nama_mapel))),
  };
};

export const fetchMapelAttendanceRecap = async ({ guruId, kelasId, mapelId, periodMode, anchorDate, fromDate, toDate }) => {
  assertRequired('guruId', guruId);
  assertRequired('kelasId', kelasId);
  assertRequired('mapelId', mapelId);

  const period = buildPeriodRange({ mode: periodMode, anchorDate, fromDate, toDate });

  const { data: sessionRows, error: sessionError } = await supabase
    .from('session')
    .select('id, tanggal, created_at, schedule:schedule_id!inner(guru_id, kelas_id, mapel_id)')
    .eq('schedule.guru_id', guruId)
    .eq('schedule.kelas_id', Number(kelasId))
    .eq('schedule.mapel_id', Number(mapelId))
    .gte('tanggal', period.fromDate)
    .lte('tanggal', period.toDate)
    .order('tanggal', { ascending: true });
  if (sessionError) throw sessionError;

  const sessionIds = (sessionRows || []).map((row) => row.id);

  const [{ data: students, error: studentError }, { data: attendanceRows, error: attendanceError }] = await Promise.all([
    supabase.from('master_siswa').select('id, nama_siswa, nis').eq('kelas_id', Number(kelasId)).eq('status', 'aktif'),
    sessionIds.length
      ? supabase.from('student_attendance_mapel').select('session_id, siswa_id, status').in('session_id', sessionIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (studentError) throw studentError;
  if (attendanceError) throw attendanceError;

  const rows = buildStudentRecapRows({ students, sessionIds, attendanceRows });
  const summary = summarizeRecapRows(rows);
  const postingDate = (sessionRows || []).length > 0 ? (sessionRows || []).map((row) => row.created_at).filter(Boolean).sort().slice(-1)[0] : null;

  return {
    period,
    postingDate,
    totalPertemuan: sessionIds.length,
    rows,
    summary,
  };
};

export const fillMissingAttendanceForSession = async ({ sessionId, siswaId, status, actorName }) => {
  assertRequired('sessionId', sessionId);
  assertRequired('siswaId', siswaId);
  assertRequired('status', status);

  const normalized = String(status).trim().toUpperCase();
  if (!['H', 'S', 'I', 'A'].includes(normalized)) {
    throw new Error('Status absensi tidak valid.');
  }

  const payload = {
    session_id: sessionId,
    siswa_id: siswaId,
    status: normalized,
    diubah_pada: new Date().toISOString(),
    diubah_oleh: actorName || null,
  };

  const { data, error } = await supabase
    .from('student_attendance_mapel')
    .upsert(payload, { onConflict: 'session_id,siswa_id' })
    .select('*')
    .single();
  if (error) throw error;
  return data;
};
```

- [ ] **Step 4: Re-run unit tests**

Run: `npm run test:unit`
Expected: PASS termasuk test validasi range.

- [ ] **Step 5: Run lint for service changes**

Run: `npm run lint`
Expected: PASS (tanpa error baru).

- [ ] **Step 6: Commit task 2**

```bash
git add src/services/mapelService.js src/features/mapel/utils/attendanceRecapRules.test.mjs
git commit -m "feat: add mapel attendance recap service and backfill api"
```

### Task 3: Wire Routes + Sidebar + Rekap Page UI

**Files:**
- Modify: `src/shared/constants/routes.js`
- Modify: `src/routes/AppRoutes.jsx`
- Modify: `src/app/AppShell.jsx`
- Modify: `src/features/mapel/pages/MapelHomePage.jsx`
- Create: `src/features/mapel/pages/MapelAttendanceRecapPage.jsx`

- [ ] **Step 1: Write failing test for recap period label (UI helper)**

```js
test('buildPeriodRange range label is Rentang tanggal', () => {
  const range = buildPeriodRange({ mode: 'range', fromDate: '2026-04-01', toDate: '2026-04-10' });
  assert.equal(range.label, 'Rentang tanggal');
});
```

- [ ] **Step 2: Run unit tests to verify RED if helper missing**

Run: `npm run test:unit`
Expected: FAIL if label contract not met.

- [ ] **Step 3: Add new route constant**

```js
// routes.js
export const MAPEL_RECAP_ROUTE = '/mapel/rekap-kehadiran';
```

- [ ] **Step 4: Register protected route in AppRoutes**

```jsx
<Route
  path={MAPEL_RECAP_ROUTE}
  element={
    <RequireRole allow={canAccessMapel}>
      <MapelAttendanceRecapPage user={userData} />
    </RequireRole>
  }
/>
```

- [ ] **Step 5: Add sidebar item only in mapel workspace block**

```js
const navMapel = [
  { to: MAPEL_SCHEDULE_ROUTE, icon: BookOpen, label: 'Jadwal Mengajar' },
  { to: MAPEL_SESSION_ROUTE, icon: ClipboardCheck, label: 'Sesi & Absensi' },
  { to: MAPEL_SCORE_ROUTE, icon: BarChart3, label: 'Nilai Harian' },
  { to: MAPEL_RECAP_ROUTE, icon: FileText, label: 'Rekapitulasi KBM' },
  { to: MAPEL_HISTORY_ROUTE, icon: History, label: 'Riwayat Sesi' },
];
```

- [ ] **Step 6: Create recap page UI skeleton + filter behavior**

```jsx
const [filters, setFilters] = useState({ kelasId: '', mapelId: '', periodMode: 'monthly', anchorDate: getTodayDateWIB(), fromDate: '', toDate: '' });
const [result, setResult] = useState(null);

const handleApply = async () => {
  if (!filters.kelasId || !filters.mapelId) {
    await Swal.fire('Filter belum lengkap', 'Pilih kelas dan mapel terlebih dahulu.', 'warning');
    return;
  }
  const data = await fetchMapelAttendanceRecap({
    guruId: user?.id,
    kelasId: filters.kelasId,
    mapelId: filters.mapelId,
    periodMode: filters.periodMode,
    anchorDate: filters.anchorDate,
    fromDate: filters.fromDate,
    toDate: filters.toDate,
  });
  setResult(data);
};
```

- [ ] **Step 7: Add Home shortcut to recap page**

```jsx
<Link to={MAPEL_RECAP_ROUTE} className="rounded-xl border ...">
  <p className="text-xs ...">Laporan</p>
  <p className="mt-1 font-bold ...">Rekapitulasi KBM</p>
  <p className="mt-1 text-xs ...">Ringkasan H/S/I/A, belum diisi, dan persentase kehadiran.</p>
</Link>
```

- [ ] **Step 8: Run lint and unit tests**

Run: `npm run test:unit && npm run lint`
Expected: PASS.

- [ ] **Step 9: Commit task 3**

```bash
git add src/shared/constants/routes.js src/routes/AppRoutes.jsx src/app/AppShell.jsx src/features/mapel/pages/MapelHomePage.jsx src/features/mapel/pages/MapelAttendanceRecapPage.jsx
git commit -m "feat: add mapel attendance recap page and navigation"
```

### Task 4: Add Backfill Action + Excel Export Consistency + Finalization

**Files:**
- Modify: `src/features/mapel/pages/MapelAttendanceRecapPage.jsx`
- Modify: `src/services/mapelService.js`
- Modify: `src/services/shared/excelService.js` (only if metadata rows needed)
- Modify: `v2-log.md`

- [ ] **Step 1: Write failing test for summary finality**

```js
test('summarizeRecapRows marks final when all belum_diisi are zero', () => {
  const summary = summarizeRecapRows([{ belum_diisi: 0 }, { belum_diisi: 0 }]);
  assert.equal(summary.isFinal, true);
  assert.equal(summary.statusLabel, 'Final');
});
```

- [ ] **Step 2: Run unit tests to verify RED**

Run: `npm run test:unit`
Expected: FAIL if summary finality behavior mismatch.

- [ ] **Step 3: Implement backfill and warning UX in recap page**

```jsx
const handleFixMissing = async () => {
  if (!result || result.summary.totalBelumDiisi === 0) return;
  await Swal.fire('Perbaiki Data Bolong', 'Gunakan aksi koreksi per sesi/siswa untuk melengkapi data.', 'info');
  // lanjutkan flow koreksi terarah sesuai session/siswa yang belum diisi
};

{result?.summary?.totalBelumDiisi > 0 && (
  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
    Data belum final: masih ada {result.summary.totalBelumDiisi} entri belum diisi.
  </div>
)}
```

- [ ] **Step 4: Implement Excel export from active dataset only**

```jsx
const handleDownloadExcel = async () => {
  if (!result || !result.rows?.length) {
    await Swal.fire('Tidak ada data', 'Terapkan filter dulu sebelum export.', 'info');
    return;
  }

  const exportRows = result.rows.map((row) => ({
    Nama: row.nama_siswa,
    NIS: row.nis,
    'Total Pertemuan': row.total_pertemuan,
    H: row.hadir,
    S: row.sakit,
    I: row.izin,
    A: row.alpha,
    'Belum Diisi': row.belum_diisi,
    '% Kehadiran': row.persentase_kehadiran,
  }));

  await exportJsonToExcel({
    rows: exportRows,
    sheetName: 'Rekap Kehadiran KBM',
    fileName: `rekap-kbm-${filters.kelasId}-${filters.mapelId}-${result.period.fromDate}_${result.period.toDate}.xlsx`,
  });
};
```

- [ ] **Step 5: Update v2-log to implemented state**

```md
## 66) Sprint 55 - Rekapitulasi Kehadiran KBM + Excel Export (Implemented)
- Implementasi halaman rekap, filter periode, indikator belum diisi, perbaikan data bolong, dan export Excel selesai.
```

- [ ] **Step 6: Run full verification**

Run: `npm run test:unit && npm test`
Expected: unit tests pass, lint+build pass.

- [ ] **Step 7: Manual QA checklist**

Run manual:
1. Pilih kelas A + mapel X, pastikan data tidak mencampur kelas lain.
2. Ubah periode ke Hari ini/Bulanan/Rentang tanggal, pastikan hasil berubah sesuai filter.
3. Pastikan `Belum diisi` muncul untuk entri kosong, bukan otomatis A.
4. Jalankan perbaikan data bolong dan pastikan ringkasan finalitas berubah.
5. Download Excel dan verifikasi isi sama dengan tabel aktif.

Expected: semua skenario berhasil.

- [ ] **Step 8: Commit task 4**

```bash
git add src/features/mapel/pages/MapelAttendanceRecapPage.jsx src/services/mapelService.js src/services/shared/excelService.js v2-log.md
git commit -m "feat: ship mapel attendance recap with backfill and excel export"
```

## Final Verification Checklist

- [ ] `npm run test:unit`
- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `npm test`
- [ ] Manual smoke test halaman `Rekapitulasi KBM`
