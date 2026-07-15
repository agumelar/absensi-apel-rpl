# Executive Teacher Performance + Audit Trail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menyelesaikan sprint executive 1-2 minggu untuk `Teacher Performance` dan `Audit Trail Mapel` dengan KPI akurat, export konsisten, alert actionable, dan scope role `kaprog` per jurusan.

**Architecture:** Tambahkan satu kontrak KPI executive terpusat di service layer (`mapelService`) yang dipakai bersama oleh UI, export, dan alert. Scope akses dibentuk sekali via resolver role-aware (`kaprog` jurusan-only; `kepsek/kurikulum` global) agar tidak ada drift antar query. Halaman `Teacher Performance` dan `Audit Trail` menjadi consumer dataset yang sama, sementara `Executive Control` tidak disentuh.

**Tech Stack:** React 19, Supabase JS, SweetAlert2, ExcelJS, Node test runner (`node --test`), ESLint + Vite.

---

## File Structure (Locked)

- Create: `src/features/dashboard/utils/executiveKpiRules.js`
  - Pure functions formula KPI executive (presence, late, tidak masuk, SLA breach, impacted classes, trend).
- Create: `src/features/dashboard/utils/executiveKpiRules.test.mjs`
  - Unit test formula dan edge-case KPI.
- Modify: `src/services/mapelService.js`
  - Scope resolver role-aware + service dataset KPI + hard filter jurusan untuk `kaprog`.
- Modify: `src/features/dashboard/pages/TeacherPerformancePage.jsx`
  - Consume dataset KPI baru + filter tambahan + panel alert/action + export.
- Modify: `src/features/mapel/pages/MapelAuditTrailPage.jsx`
  - Consume KPI context dari dataset yang sama + export parity.
- Modify: `src/services/shared/excelService.js`
  - Tambah exporter dedicated `Teacher Performance` dan `Audit Trail` session-centric.
- Modify: `package.json`
  - Tambah file unit test KPI ke script `test:unit`.
- Modify: `v2-log.md`
  - Catat progres implementasi sprint executive.

### Task 1: Build KPI Rules (Pure Functions + Unit Tests)

**Files:**
- Create: `src/features/dashboard/utils/executiveKpiRules.js`
- Create: `src/features/dashboard/utils/executiveKpiRules.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write failing tests for KPI formulas**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeTeacherRates,
  computeSlaBreach,
  buildImpactedClassBuckets,
  buildTrendBuckets,
} from './executiveKpiRules.js';

test('computeTeacherRates returns presence/late/tidakMasuk percentage', () => {
  const result = computeTeacherRates({
    totalScheduled: 10,
    totalHadir: 7,
    totalTidakMasuk: 2,
    totalLate: 3,
  });
  assert.equal(result.presenceRate, 70);
  assert.equal(result.tidakMasukRate, 20);
  assert.equal(result.lateRate, 42.9);
});

test('computeSlaBreach marks breach after minute-16', () => {
  const result = computeSlaBreach({ startMinutes: 420, nowMinutes: 436, hasCheckIn: false });
  assert.equal(result.isBreach, true);
});

test('buildImpactedClassBuckets counts distinct kelas per day', () => {
  const buckets = buildImpactedClassBuckets([
    { tanggal: '2026-04-04', kelas_id: 1, breached: true },
    { tanggal: '2026-04-04', kelas_id: 1, breached: true },
    { tanggal: '2026-04-04', kelas_id: 2, breached: true },
  ]);
  assert.equal(buckets[0].impactedClasses, 2);
});
```

- [ ] **Step 2: Run test to verify RED state**

Run: `node --test src/features/dashboard/utils/executiveKpiRules.test.mjs`  
Expected: FAIL (module belum ada).

- [ ] **Step 3: Implement minimal KPI rules**

```js
const toPercent = (numerator, denominator) => {
  if (!denominator || denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
};

export const computeTeacherRates = ({ totalScheduled, totalHadir, totalTidakMasuk, totalLate }) => ({
  presenceRate: toPercent(totalHadir, totalScheduled),
  tidakMasukRate: toPercent(totalTidakMasuk, totalScheduled),
  lateRate: toPercent(totalLate, totalHadir),
});

export const computeSlaBreach = ({ startMinutes, nowMinutes, hasCheckIn }) => ({
  isBreach: !hasCheckIn && Number(nowMinutes) > Number(startMinutes) + 15,
});

export const buildImpactedClassBuckets = (rows = []) => {
  const map = new Map();
  rows.forEach((row) => {
    const key = String(row.tanggal || '');
    const value = map.get(key) || new Set();
    if (row.breached && row.kelas_id) value.add(String(row.kelas_id));
    map.set(key, value);
  });
  return [...map.entries()].map(([tanggal, kelasSet]) => ({ tanggal, impactedClasses: kelasSet.size }));
};

export const buildTrendBuckets = (rows = [], dimension = 'guru') => {
  const map = new Map();
  rows.forEach((row) => {
    const bucket = `${row.tanggal}|${row[dimension] || '-'}`;
    const current = map.get(bucket) || { total: 0, hadir: 0, tidakMasuk: 0, late: 0 };
    current.total += 1;
    if (row.statusNorm === 'hadir') current.hadir += 1;
    if (row.statusNorm === 'tidak masuk') current.tidakMasuk += 1;
    if (row.isLate) current.late += 1;
    map.set(bucket, current);
  });
  return [...map.entries()].map(([key, value]) => ({ bucket: key, ...value }));
};
```

- [ ] **Step 4: Register new test file in `test:unit`**

```json
{
  "scripts": {
    "test:unit": "node --test src/shared/utils/compressionPolicy.test.mjs src/features/mapel/utils/sessionWorkflowRules.test.mjs src/features/mapel/utils/attendanceRecapRules.test.mjs src/features/mapel/utils/scoreRecapRules.test.mjs src/features/mapel/utils/sessionHistoryRules.test.mjs src/features/mapel/utils/attendanceIntegrityRules.test.mjs src/features/dashboard/utils/executiveKpiRules.test.mjs"
  }
}
```

- [ ] **Step 5: Run tests to verify GREEN**

Run: `npm run test:unit`  
Expected: PASS termasuk test KPI baru.

- [ ] **Step 6: Commit task 1**

```bash
git add src/features/dashboard/utils/executiveKpiRules.js src/features/dashboard/utils/executiveKpiRules.test.mjs package.json
git commit -m "test: add executive KPI formula rules"
```

### Task 2: Add Executive Scope Resolver and KPI Dataset Service

**Files:**
- Modify: `src/services/mapelService.js`

- [ ] **Step 1: Add role-aware scope resolver (`kaprog` jurusan-only)**

```js
const resolveExecutiveScopeOrThrow = async () => {
  const session = assertExecutiveAccessOrThrow();
  const role = normalizeRole(session.role);
  if (role !== 'kaprog') {
    return { role, jurusanId: null, isJurusanScoped: false };
  }

  let jurusanId = Number.parseInt(session.jurusan_id, 10);
  if (!Number.isInteger(jurusanId) || jurusanId <= 0) {
    const actorId = session.walikelas_id || session.id;
    const { data, error } = await supabase.from('walikelas').select('jurusan_id').eq('id', actorId).maybeSingle();
    if (error) throw error;
    jurusanId = Number.parseInt(data?.jurusan_id, 10);
  }

  if (!Number.isInteger(jurusanId) || jurusanId <= 0) {
    throw new Error('Scope jurusan kaprog tidak valid. Hubungi admin untuk sinkronisasi profil jurusan.');
  }

  return { role, jurusanId, isJurusanScoped: true };
};
```

- [ ] **Step 2: Implement `fetchExecutiveMapelKpiDataset(...)` service**

```js
export const fetchExecutiveMapelKpiDataset = async ({ fromDate, toDate, kelasId, mapelId, guruId, trendBy = 'guru' } = {}) => {
  const scope = await resolveExecutiveScopeOrThrow();
  let kelasQuery = supabase.from('master_kelas').select('id, jurusan_id');
  if (scope.isJurusanScoped) kelasQuery = kelasQuery.eq('jurusan_id', scope.jurusanId);
  const { data: kelasRows, error: kelasError } = await kelasQuery;
  if (kelasError) throw kelasError;

  const allowedKelasIds = new Set((kelasRows || []).map((k) => Number(k.id)));
  if (kelasId && !allowedKelasIds.has(Number(kelasId))) {
    return { summary: {}, teacherRows: [], trendRows: [], impactedRows: [], alertRows: [] };
  }

  // lanjutkan query session + schedule lalu hitung metrik menggunakan executiveKpiRules.
};
```

- [ ] **Step 3: Refactor `fetchMapelTeacherPerformance` to reuse KPI dataset**

```js
export const fetchMapelTeacherPerformance = async (params = {}) => {
  const dataset = await fetchExecutiveMapelKpiDataset(params);
  return {
    summary: dataset.summary,
    rows: dataset.teacherRows,
    trendRows: dataset.trendRows,
    alertRows: dataset.alertRows,
    impactedRows: dataset.impactedRows,
  };
};
```

- [ ] **Step 4: Refactor `fetchMapelAuditFilterOptions` with same scope**

```js
export const fetchMapelAuditFilterOptions = async () => {
  const scope = await resolveExecutiveScopeOrThrow();
  let kelasQuery = supabase.from('master_kelas').select('id, nama_kelas, jurusan_id').order('nama_kelas');
  if (scope.isJurusanScoped) kelasQuery = kelasQuery.eq('jurusan_id', scope.jurusanId);
  const { data: kelasData, error: kelasError } = await kelasQuery;
  if (kelasError) throw kelasError;

  // mapel options bisa global, tapi data result tetap terbatas lewat query session scoped.
  const { data: mapelData, error: mapelError } = await supabase
    .from('master_mapel')
    .select('id, nama_mapel, kode_mapel')
    .order('nama_mapel');
  if (mapelError) throw mapelError;
  return { kelasOptions: kelasData || [], mapelOptions: mapelData || [] };
};
```

- [ ] **Step 5: Run verification**

Run: `npm run lint`  
Expected: PASS.

- [ ] **Step 6: Commit task 2**

```bash
git add src/services/mapelService.js
git commit -m "feat: enforce executive scope and unified KPI dataset"
```

### Task 3: Upgrade Teacher Performance Page (KPI + Alert + Export)

**Files:**
- Modify: `src/features/dashboard/pages/TeacherPerformancePage.jsx`
- Modify: `src/services/mapelService.js`
- Modify: `src/services/shared/excelService.js`

- [ ] **Step 1: Add UI state for trend, impacted classes, and alert list**

```js
const [performance, setPerformance] = useState({
  summary: {},
  rows: [],
  trendRows: [],
  impactedRows: [],
  alertRows: [],
});
const [trendBy, setTrendBy] = useState('guru');
```

- [ ] **Step 2: Wire filter params to unified dataset service**

```js
const data = await fetchMapelTeacherPerformance({
  fromDate,
  toDate,
  kelasId: kelasId === 'all' ? undefined : Number.parseInt(kelasId, 10),
  trendBy,
  limit: 600,
});
setPerformance(data);
```

- [ ] **Step 3: Add cards for required KPI summary**

```jsx
<div className="grid grid-cols-2 gap-3 md:grid-cols-6">
  <KpiCard label="Presence Rate" value={`${performance.summary.presenceRate || 0}%`} />
  <KpiCard label="Late Rate" value={`${performance.summary.lateRate || 0}%`} />
  <KpiCard label="Tidak Masuk Rate" value={`${performance.summary.tidakMasukRate || 0}%`} />
  <KpiCard label="SLA Breach" value={`${performance.summary.slaBreachRate || 0}%`} />
  <KpiCard label="Kelas Terdampak" value={performance.summary.impactedClasses || 0} />
  <KpiCard label="Total Sesi" value={performance.summary.totalSessions || 0} />
</div>
```

- [ ] **Step 4: Add alert panel with actionable context**

```jsx
{performance.alertRows?.length > 0 && (
  <Card>
    <CardContent className="p-4 space-y-2">
      {performance.alertRows.map((item) => (
        <div key={item.session_id} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
          <p className="font-bold">{item.kelas_nama} • {item.mapel_nama}</p>
          <p>{item.guru_nama} • {item.warning_label}</p>
        </div>
      ))}
    </CardContent>
  </Card>
)}
```

- [ ] **Step 5: Add export button and dedicated exporter call**

```js
await exportTeacherPerformanceToExcel({
  meta: {
    periodeLabel: periodLabel,
    trendBy,
    roleScopeLabel: isKaprog ? 'Kaprog (Jurusan)' : 'Global Executive',
  },
  rows: performance.rows,
  summary: performance.summary,
});
```

- [ ] **Step 6: Run verification**

Run: `npm run lint && npm run build`  
Expected: PASS.

- [ ] **Step 7: Commit task 3**

```bash
git add src/features/dashboard/pages/TeacherPerformancePage.jsx src/services/shared/excelService.js src/services/mapelService.js
git commit -m "feat: upgrade teacher performance KPI, alerts, and export"
```

### Task 4: Add KPI Context + Export Parity in Audit Trail

**Files:**
- Modify: `src/features/mapel/pages/MapelAuditTrailPage.jsx`
- Modify: `src/services/mapelService.js`
- Modify: `src/services/shared/excelService.js`

- [ ] **Step 1: Fetch KPI context from same dataset contract**

```js
const [kpiContext, setKpiContext] = useState(null);

const kpiData = await fetchExecutiveMapelKpiDataset({
  fromDate: filters.fromDate,
  toDate: filters.toDate,
  kelasId: filters.kelasId !== 'all' ? Number(filters.kelasId) : undefined,
  mapelId: filters.mapelId !== 'all' ? Number(filters.mapelId) : undefined,
  trendBy: 'kelas',
});
setKpiContext(kpiData.summary);
```

- [ ] **Step 2: Render lightweight KPI context strip above session cards**

```jsx
{kpiContext && (
  <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-xs">
    <InfoBadge label="Presence" value={`${kpiContext.presenceRate || 0}%`} />
    <InfoBadge label="Late" value={`${kpiContext.lateRate || 0}%`} />
    <InfoBadge label="Tidak Masuk" value={`${kpiContext.tidakMasukRate || 0}%`} />
    <InfoBadge label="SLA Breach" value={`${kpiContext.slaBreachRate || 0}%`} />
    <InfoBadge label="Kelas Terdampak" value={kpiContext.impactedClasses || 0} />
    <InfoBadge label="Total Sesi" value={kpiContext.totalSessions || 0} />
  </div>
)}
```

- [ ] **Step 3: Replace generic export with dedicated audit exporter**

```js
await exportMapelAuditSessionSummaryToExcel({
  meta: {
    periodeLabel: `${filters.fromDate} s/d ${filters.toDate}`,
    kelasLabel: selectedKelasLabel,
    mapelLabel: selectedMapelLabel,
  },
  summary: kpiContext,
  rows: exportRows,
});
```

- [ ] **Step 4: Keep session-centric content unchanged**

```jsx
// Jangan ubah blok inti session card:
// - identitas sesi
// - check-in/out + foto
// - agenda
// - rekap absensi siswa
// - panel tidak masuk + lampiran
```

- [ ] **Step 5: Run verification**

Run: `npm run lint && npm run build`  
Expected: PASS.

- [ ] **Step 6: Commit task 4**

```bash
git add src/features/mapel/pages/MapelAuditTrailPage.jsx src/services/mapelService.js src/services/shared/excelService.js
git commit -m "feat: align audit trail KPI context and export parity"
```

### Task 5: Add Dedicated Excel Exporters

**Files:**
- Modify: `src/services/shared/excelService.js`

- [ ] **Step 1: Implement `exportTeacherPerformanceToExcel`**

```js
export const exportTeacherPerformanceToExcel = async ({ meta = {}, summary = {}, rows = [] } = {}) => {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Teacher Performance');
  ws.addRow(['Periode', String(meta.periodeLabel || '-')]);
  ws.addRow(['Scope', String(meta.roleScopeLabel || '-')]);
  ws.addRow(['Trend By', String(meta.trendBy || '-')]);
  ws.addRow([]);
  ws.addRow(['Presence Rate', `${summary.presenceRate || 0}%`]);
  ws.addRow(['Late Rate', `${summary.lateRate || 0}%`]);
  ws.addRow(['Tidak Masuk Rate', `${summary.tidakMasukRate || 0}%`]);
  ws.addRow([]);
  ws.addRow(['Guru', 'Total Sesi', 'Hadir', 'Late', 'Tidak Masuk', 'Presence %', 'Late %']);
  rows.forEach((row) => ws.addRow([row.guru_nama, row.total_sessions, row.hadir_sessions, row.telat_sessions, row.tidak_masuk_sessions, row.presence_rate, row.late_rate]));
  // finalize download buffer...
};
```

- [ ] **Step 2: Implement `exportMapelAuditSessionSummaryToExcel`**

```js
export const exportMapelAuditSessionSummaryToExcel = async ({ meta = {}, summary = {}, rows = [] } = {}) => {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet('Audit Session Summary');
  ws.addRow(['Periode', String(meta.periodeLabel || '-')]);
  ws.addRow(['Kelas', String(meta.kelasLabel || 'Semua Kelas')]);
  ws.addRow(['Mapel', String(meta.mapelLabel || 'Semua Mapel')]);
  ws.addRow(['Presence Rate', `${summary?.presenceRate || 0}%`]);
  ws.addRow([]);
  ws.addRow(['Tanggal', 'Guru', 'Kelas', 'Mapel', 'Status', 'Check-In', 'Check-Out', 'H', 'S', 'I', 'A', 'Topik', 'Metode']);
  rows.forEach((row) => ws.addRow([
    row.tanggal || '-',
    row.guru_nama || '-',
    row.kelas_nama || '-',
    row.mapel_nama || '-',
    row.status || '-',
    row.waktu_check_in || '-',
    row.waktu_check_out || '-',
    row.attendance_summary?.hadir || 0,
    row.attendance_summary?.sakit || 0,
    row.attendance_summary?.izin || 0,
    row.attendance_summary?.alpha || 0,
    row.agenda_topik || '-',
    row.agenda_metode || '-',
  ]));
  // finalize download buffer...
};
```

- [ ] **Step 3: Run verification**

Run: `npm run lint`  
Expected: PASS.

- [ ] **Step 4: Commit task 5**

```bash
git add src/services/shared/excelService.js
git commit -m "feat: add dedicated executive excel exporters"
```

### Task 6: Final Verification, Log Update, and Handoff

**Files:**
- Modify: `v2-log.md`

- [ ] **Step 1: Add sprint completion log entry**

```md
## 74) Sprint 63 - Executive KPI Contract Alignment for Teacher Performance + Audit Trail (Implemented)
- Fokus perubahan hanya pada `Teacher Performance` dan `Audit Trail Mapel`; `Executive Control` kesiswaan tetap tidak diubah.
- Menambahkan scope resolver role-aware:
  - `kaprog` hanya data jurusan sendiri,
  - `kepsek` dan `kurikulum` tetap global.
- Menyatukan kontrak KPI agar angka konsisten lintas kartu, tabel, export, dan alert.
- Menambahkan context KPI di audit trail tanpa mengubah sifat session-centric.
- Menambahkan exporter dedicated untuk Teacher Performance dan Audit Trail session summary.
- Validasi pasca implementasi:
  - `npm run test:unit` lulus,
  - `npm run lint` lulus,
  - `npm run build` lulus,
  - `npm test` lulus.
```

- [ ] **Step 2: Run full verification gate**

Run: `npm run test:unit && npm run lint && npm run build && npm test`  
Expected: PASS semua command.

- [ ] **Step 3: Commit task 6**

```bash
git add v2-log.md
git commit -m "docs: log executive KPI alignment sprint"
```

- [ ] **Step 4: Prepare implementation handoff checklist**

```md
- [ ] Scope role kaprog sudah teruji jurusan-only
- [ ] Angka Teacher Performance == dataset export
- [ ] Angka Audit Trail context == dataset export
- [ ] Executive Control kesiswaan tidak berubah
```

## Plan Self-Review

- Spec coverage: seluruh requirement dari spec 2026-04-04 tercakup (KPI contract, RBAC scope, export parity, alert context, DoD, verification).
- Placeholder scan: tidak ada `TODO/TBD/implement later`.
- Type consistency: nama field dan fungsi konsisten antar task (`fetchExecutiveMapelKpiDataset`, `resolveExecutiveScopeOrThrow`, `exportTeacherPerformanceToExcel`, `exportMapelAuditSessionSummaryToExcel`).
