# Executive Pembiasaan Two Tabs + School Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengubah laporan pembiasaan executive menjadi 2 tab (Monitoring Harian + Rekap Guru) dengan kalkulasi kewajiban berbasis kalender sekolah, serta memastikan auto-alpha skip weekend/libur sekolah.

**Architecture:** UI dipecah menjadi dua dataset terfokus: detail harian dan agregat per-guru. Service layer menambahkan agregasi rekap dan helper hari aktif sekolah. Database menambah tabel kalender sekolah + fungsi utilitas hari aktif yang dipakai untuk auto-alpha dan rekap. Kebijakan akses kalender: admin CRUD, executive read-only.

**Tech Stack:** React, Supabase JS, Postgres (Supabase migrations + RPC), ESLint, Node test runner.

---

## File Structure

- Create: `supabase/migrations/20260405_create_school_calendar_and_rekap_helpers.sql`
  - Menyediakan tabel kalender sekolah + function helper hari aktif + update finalize auto-alpha.
- Modify: `src/services/pembiasaanService.js`
  - Tambah fetch data monitoring harian dan rekap guru dengan kewajiban berbasis hari aktif.
- Modify: `src/features/pembiasaan/pages/ExecutivePembiasaanReportPage.jsx`
  - Ubah layout jadi 2 tab + filter dan tabel masing-masing tab.
- Create: `src/features/pembiasaan/utils/executivePembiasaanReportRules.js`
  - Helper transform/format ringkas untuk monitoring dan rekap (pure function).
- Create: `src/features/pembiasaan/utils/executivePembiasaanReportRules.test.mjs`
  - Test helper tab monitor + rekap.
- Modify: `package.json`
  - Tambahkan file test baru ke `test:unit`.
- Modify: `docs/superpowers/specs/2026-04-04-pembiasaan-role-qa-checklist.md`
  - Tambah matrix uji 2 tab + kalender sekolah.
- Modify: `v2-log.md`
  - Catat sprint implementasi agar mudah ditelusuri.

### Task 1: Add Failing Tests for Executive Report Rules

**Files:**
- Create: `src/features/pembiasaan/utils/executivePembiasaanReportRules.test.mjs`
- Create: `src/features/pembiasaan/utils/executivePembiasaanReportRules.js`

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDailyMonitoringRows,
  buildTeacherRecapRows,
} from './executivePembiasaanReportRules.js';

test('buildDailyMonitoringRows keeps only selected date and sorts by checkin', () => {
  const rows = [
    { tanggal: '2026-04-06', nama_lengkap: 'B', checkin_at: '2026-04-06T06:10:00Z', status: 'hadir' },
    { tanggal: '2026-04-06', nama_lengkap: 'A', checkin_at: null, status: 'izin' },
    { tanggal: '2026-04-07', nama_lengkap: 'C', checkin_at: '2026-04-07T06:00:00Z', status: 'hadir' },
  ];

  const result = buildDailyMonitoringRows(rows, '2026-04-06');
  assert.equal(result.length, 2);
  assert.equal(result[0].nama_lengkap, 'B');
});

test('buildTeacherRecapRows computes total aktual and kepatuhan', () => {
  const rows = [
    { user_id: 'u1', nama_lengkap: 'Guru A', status: 'hadir' },
    { user_id: 'u1', nama_lengkap: 'Guru A', status: 'alpha' },
  ];

  const obligations = { u1: 4 };
  const result = buildTeacherRecapRows(rows, obligations);

  assert.equal(result[0].total_aktual, 2);
  assert.equal(result[0].total_kewajiban, 4);
  assert.equal(result[0].kepatuhan_persen, 50);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/features/pembiasaan/utils/executivePembiasaanReportRules.test.mjs`
Expected: FAIL (`ERR_MODULE_NOT_FOUND` atau function belum ada).

- [ ] **Step 3: Write minimal implementation**

```js
const toTimeSortValue = (row) => (row.checkin_at ? String(row.checkin_at) : '9999');

export const buildDailyMonitoringRows = (rows = [], targetDate) =>
  (rows || [])
    .filter((row) => String(row.tanggal || '') === String(targetDate || ''))
    .sort((a, b) => toTimeSortValue(a).localeCompare(toTimeSortValue(b)));

export const buildTeacherRecapRows = (rows = [], obligationsByUserId = {}) => {
  const map = new Map();

  (rows || []).forEach((row) => {
    const key = String(row.user_id || '');
    if (!key) return;
    if (!map.has(key)) {
      map.set(key, {
        user_id: key,
        nama_lengkap: row.nama_lengkap || '-',
        hadir: 0,
        izin: 0,
        sakit: 0,
        alpha: 0,
      });
    }
    const rec = map.get(key);
    const st = String(row.status || '').toLowerCase();
    if (st === 'hadir') rec.hadir += 1;
    else if (st === 'izin') rec.izin += 1;
    else if (st === 'sakit') rec.sakit += 1;
    else if (st === 'alpha') rec.alpha += 1;
  });

  return Array.from(map.values()).map((item) => {
    const totalAktual = item.hadir + item.izin + item.sakit + item.alpha;
    const totalKewajiban = Number(obligationsByUserId[item.user_id] || 0);
    const kepatuhan = totalKewajiban > 0 ? Math.round((totalAktual / totalKewajiban) * 10000) / 100 : 0;
    return {
      ...item,
      total_aktual: totalAktual,
      total_kewajiban: totalKewajiban,
      kepatuhan_persen: kepatuhan,
    };
  });
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/features/pembiasaan/utils/executivePembiasaanReportRules.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/pembiasaan/utils/executivePembiasaanReportRules.js src/features/pembiasaan/utils/executivePembiasaanReportRules.test.mjs
git commit -m "test: add executive pembiasaan report rule helpers"
```

### Task 2: Add School Calendar and Active-Day Helpers in Database

**Files:**
- Create: `supabase/migrations/20260405_create_school_calendar_and_rekap_helpers.sql`

- [ ] **Step 1: Write the failing verification query (manual)**

```sql
select public.fn_is_school_active_day((timezone('Asia/Jakarta', now()))::date);
```

Expected: FAIL karena function belum ada.

- [ ] **Step 2: Apply migration with minimal schema + helper functions**

```sql
create table if not exists public.school_calendar (
  id uuid primary key default uuid_generate_v4(),
  tanggal date not null unique,
  is_libur boolean not null default true,
  keterangan text,
  updated_by uuid,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint school_calendar_updated_by_fkey foreign key (updated_by) references public.walikelas(id)
);

create or replace function public.fn_is_school_active_day(p_date date)
returns boolean
language sql
stable
as $$
  select
    (extract(isodow from p_date) between 1 and 5)
    and not exists (
      select 1
      from public.school_calendar sc
      where sc.tanggal = p_date
        and sc.is_libur = true
    );
$$;
```

- [ ] **Step 3: Update finalize function to skip non-active day**

```sql
create or replace function public.fn_finalize_auto_alpha(p_tanggal date default app.wib_today())
returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  target_date date := coalesce(p_tanggal, app.wib_today());
begin
  if not public.fn_is_school_active_day(target_date) then
    return jsonb_build_object(
      'success', true,
      'tanggal', target_date,
      'inserted_sapa_pagi_alpha', 0,
      'inserted_pembiasaan_alpha', 0
    );
  end if;

  -- keep existing finalize logic here (same as previous implementation)
  return jsonb_build_object(
    'success', true,
    'tanggal', target_date,
    'inserted_sapa_pagi_alpha', 0,
    'inserted_pembiasaan_alpha', 0
  );
end;
$$;
```

- [ ] **Step 4: Run verification SQL**

```sql
select public.fn_is_school_active_day('2026-04-06'::date) as senin_default,
       public.fn_is_school_active_day('2026-04-05'::date) as minggu_default;
```

Expected: `senin_default = true`, `minggu_default = false` (kecuali ada entry libur khusus).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260405_create_school_calendar_and_rekap_helpers.sql
git commit -m "feat: add school calendar helper for active-day checks"
```

### Task 3: Implement Service Aggregation for Two Tabs

**Files:**
- Modify: `src/services/pembiasaanService.js`
- Modify: `src/features/pembiasaan/utils/executivePembiasaanReportRules.js`

- [ ] **Step 1: Write failing test for service-side recap transformation**

```js
test('buildTeacherRecapRows sets zero obligation safely', () => {
  const rows = [{ user_id: 'u1', nama_lengkap: 'Guru A', status: 'hadir' }];
  const result = buildTeacherRecapRows(rows, {});
  assert.equal(result[0].total_kewajiban, 0);
  assert.equal(result[0].kepatuhan_persen, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/features/pembiasaan/utils/executivePembiasaanReportRules.test.mjs`
Expected: FAIL sebelum update helper.

- [ ] **Step 3: Implement service API for two-tab datasets**

```js
export const fetchExecutivePembiasaanReport = async (filters = {}) => {
  // 1) fetch base detail rows
  // 2) fetch school_calendar on date range
  // 3) build obligations by user/activity
  // 4) return {
  //      scope,
  //      monitoringRows,
  //      recapRows,
  //      summary
  //    }
};
```

- [ ] **Step 4: Re-run tests**

Run: `npm run test:unit`
Expected: PASS seluruh test unit.

- [ ] **Step 5: Commit**

```bash
git add src/services/pembiasaanService.js src/features/pembiasaan/utils/executivePembiasaanReportRules.js src/features/pembiasaan/utils/executivePembiasaanReportRules.test.mjs
git commit -m "feat: provide two-tab executive pembiasaan datasets"
```

### Task 4: Redesign Executive Report Page to Two Tabs

**Files:**
- Modify: `src/features/pembiasaan/pages/ExecutivePembiasaanReportPage.jsx`

- [ ] **Step 1: Write minimal UI expectation test notes (manual QA cases)**

```txt
Case A: Tab Monitoring Harian shows only selected date rows.
Case B: Tab Rekap Guru shows H/I/S/A + total aktual + total kewajiban + kepatuhan.
Case C: Activity filter changes both tabs consistently.
```

- [ ] **Step 2: Implement tabbed UI and focused tables**

```jsx
const [activeTab, setActiveTab] = useState('monitoring');

// render tab switcher
// render monitoring table when activeTab === 'monitoring'
// render recap table when activeTab === 'rekap'
```

- [ ] **Step 3: Keep export behavior aligned with active tab**

```jsx
if (activeTab === 'monitoring') {
  // export monitoring sheet
} else {
  // export recap + summary sheets
}
```

- [ ] **Step 4: Verify UI build**

Run: `npm run lint && npm run build`
Expected: lint clean, build success.

- [ ] **Step 5: Commit**

```bash
git add src/features/pembiasaan/pages/ExecutivePembiasaanReportPage.jsx
git commit -m "feat: split executive pembiasaan report into monitoring and recap tabs"
```

### Task 5: Update QA Checklist, Test Script, and Project Log

**Files:**
- Modify: `package.json`
- Modify: `docs/superpowers/specs/2026-04-04-pembiasaan-role-qa-checklist.md`
- Modify: `v2-log.md`

- [ ] **Step 1: Add test file to unit script**

```json
"test:unit": "... src/features/pembiasaan/utils/executivePembiasaanReportRules.test.mjs"
```

- [ ] **Step 2: Extend QA checklist**

```md
- [ ] Tab Monitoring Harian menampilkan data tanggal fokus.
- [ ] Tab Rekap Guru menampilkan H/I/S/A + aktual + kewajiban + kepatuhan.
- [ ] Hari libur sekolah tidak menambah alpha otomatis.
```

- [ ] **Step 3: Add sprint entry in v2-log**

```md
## Sprint XX - Executive Pembiasaan Two Tabs + School Calendar (Implemented)
- perubahan utama
- dampak
- validasi
```

- [ ] **Step 4: Run full verification**

Run: `npm run test:unit && npm run lint && npm run build`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add package.json docs/superpowers/specs/2026-04-04-pembiasaan-role-qa-checklist.md v2-log.md
git commit -m "docs: record executive pembiasaan two-tab and school calendar rollout"
```
