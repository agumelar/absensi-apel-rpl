---
inclusion: manual
---

# ASIK — Absensi SMKN 1 Rongga (Project Overview)

> Dokumen konteks aplikasi. Panggil dengan `#project-overview` di chat kalau butuh Kiro menjelaskan / mengingat aplikasi ini.
> Domain produksi: **asik.smkn1rongga.sch.id** (nama internal: "Jingga Asik").

---

## 1. Ringkasan

Sistem manajemen kehadiran sekolah yang matang & production, bukan aplikasi absensi sederhana.
Sudah melewati 16+ sprint pengembangan (lihat `v2-log.md`). Mencakup absensi apel wali kelas,
KBM guru mapel, piket + EWS guru kosong, pembiasaan (sapa pagi), monitoring eksekutif, dan admin.

## 2. Stack Teknologi

- **Frontend:** React 19 + Vite 7 (SPA)
- **Styling:** Tailwind CSS 4 (design system shadcn-style, brand biru, dark/light mode)
- **Backend:** Supabase (`@supabase/supabase-js`) — Postgres DB, Storage, RLS, RPC
- **Routing:** react-router-dom 7
- **PWA:** `service-worker.js` + `manifest.json` (installable, offline capability)
- **Library kunci:** `html5-qrcode` (scan QR), `exceljs` (export Excel), `recharts` (grafik),
  `sweetalert2` (notif), `browser-image-compression`/canvas custom (kompres foto)
- **Node:** minimal `22.12.0` (lihat `.nvmrc` + `engines`)
- **Testing:** ESLint + Vite build (`npm run test`), unit test `node --test` (`npm run test:unit`, 95 test)

## 3. Kondisi & Batasan Development

- **Supabase FREE TIER** (batasan dana): 500MB DB, 1GB storage, 2GB bandwidth/bln, pause jika idle.
  → Aplikasi dioptimasi ekstrem: kompresi foto <10KB, bundle splitting, hemat query.
- **Env:** TIDAK perlu file `.env`. Supabase URL & anon key hardcoded di
  `src/services/supabase/client.js`. (`VITE_DEMO_MODE=true` hanya untuk build demo.)
- **Development lokal:** clone di `d:\DATA\PROJEK\absensi-apel-rpl`. Dulu dev di Google IDX, pindah lokal.

## 4. Pipeline CI/CD (PENTING)

```
Edit lokal → commit → push ke branch "main"
  → GitHub Actions (.github/workflows/deploy.yml) trigger otomatis
  → npm install + npm run build
  → FTP deploy folder dist/ ke public_html/asik.smkn1rongga.sch.id/
  → LANGSUNG LIVE di produksi (tanpa staging, tanpa konfirmasi)
```

- Workflow kedua `deploy-demo.yml`: deploy domain demo dari branch `copilot/create-demo-for-application` (build `VITE_DEMO_MODE=true`).
- `.htaccess` ada di `public/` → otomatis ke `dist/` → SPA routing jalan di Apache shared hosting.
- **Secrets FTP** (FTP_SERVER, FTP_USERNAME, FTP_PASSWORD) disimpan di GitHub Secrets.

### ⚠️ Aturan Kerja (kesepakatan dengan user)
- Kerja langsung di branch `main` (user belum nyaman branch terpisah).
- **Commit / push / sync SELALU nunggu aba-aba eksplisit dari user.** Jangan pernah push sendiri.
- Push ke `main` = deploy produksi. Pastikan `npm run test` + `npm run test:unit` lulus dulu.
- Tes manual pakai **Opsi A** (data produksi asli, bukan demo mode) — hati-hati jangan rusak data.

## 5. Struktur Folder (`src/`)

```
app/         AppShell (sidebar/header), hooks (useUserRoleFlags, useThemeMode, usePwaInstallPrompt), utils
features/    absensi, admin, auth, dashboard, mapel, monitoring, pembiasaan, piket
             (tiap fitur: pages/ + utils/ [aturan bisnis murni, teruji] + kadang components/)
routes/      AppRoutes.jsx + guards (RequireAuth, RequireRole)
services/    absensiService, mapelService (2200+ baris, inti), pembiasaanService,
             piketService, piketPrintService, mapelSyncQueueService
             auth/sessionService, shared/(attendanceDayService, dateService, excelService),
             supabase/(client, storageService)
shared/      constants (roles, routes), ui (Button, Card, InputField, PageLayout, cn), utils (compressor, compressionPolicy, attendanceTime)
demo/        demoData, demoMode, mockSupabase (mode demo terisolasi)
```

**Pola arsitektur:** Pages → Services (query + side-effect) → Utils (logika murni). Logika bisnis
diisolasi di `utils/*.js` supaya bisa di-unit-test tanpa DB.

## 6. Role (10 role)

| Role | Tugas |
|------|-------|
| `admin` | Manajemen user, siswa, kelas, mapel, kalender sekolah, pengaturan pembiasaan |
| `walas` / `walikelas` | Absensi apel harian kelas (H/S/I/A + bukti), rekap, akumulasi |
| `piket` | Koreksi absen global, layanan piket, distribusi tugas pengganti, EWS guru kosong |
| `guru` & `guru_mapel` | **Identik.** KBM mapel: jadwal, sesi (check-in/out + agenda + absensi siswa), nilai, rekap |
| `tu` | Workspace Pembiasaan (Sapa Pagi + pembiasaan harian) |
| `kepsek` | Eksekutif penuh: Executive Control + Teacher Performance + Audit Mapel + Laporan Pembiasaan |
| `kesiswaan` | Eksekutif: Executive Control + Laporan Pembiasaan (TANPA Teacher Performance & Audit Mapel) |
| `kaprog` | Eksekutif lengkap, tapi **scope dibatasi per jurusan** |
| `kurikulum` | Eksekutif: Teacher Performance + Audit Mapel + Laporan Pembiasaan (TANPA Executive Control) |

- **Flag `is_guru_mapel`** (boolean, terpisah dari role): kasih akses Modul Mapel ke role apa pun.
- **Multi-workspace:** user dengan >1 akses lihat `PortalWorkspacePage` (app switcher) saat login.
- Grup eksekutif: `EXECUTIVE_ROLES = ['kepsek','kesiswaan','kaprog','kurikulum']`.

## 7. Autentikasi & Session

- Login: query langsung tabel `walikelas` (username + password). Sukses → persist ke `localStorage` key `jingga_session_v2`.
- Session: **TTL 12 jam**, auto-rotate saat diakses, `session_version: 2`, expired/versi beda → auto-clear.
- Penjagaan berlapis di `sessionService`: `assertMapelAccessOrThrow`, `assertGuruOwnershipOrThrow`, `assertSessionOwnershipOrThrow`.
- Guard route: `RequireAuth` (cek session) + `RequireRole` (cek allow flag → redirect).

## 8. Alur Proses per Modul

### Modul Apel (`absensiService`)
Ambil siswa aktif per kelas → set status → `upsert` tabel `absensi` (onConflict `siswa_id,tanggal`).
Bukti sakit/izin: foto → kompres → bucket `bukti-absen` → simpan URL.
Guard hari aktif via `attendanceDayService` (weekend + `school_calendar.is_libur`).

### Modul Mapel (`mapelService` — inti)
State machine: `scheduled → checked_in → teaching(agenda) → checked_out` | `absent`.
- Jadwal: `validateScheduleConflict` tolak overlap waktu guru sama.
- Check-in/out: wajib foto + **validasi geo** (Haversine ke titik sekolah, `assertWithinMapelGeoPolicy`).
- Agenda gate: `enforceAgendaSubmitted` — absensi terkunci sampai agenda (topik/metode) diisi.
- Absensi siswa: manual klik (flow utama) + QR scanner opsional.
- Checkout: `canCheckOutSession` (schedule + session + check-in + agenda + rasio absensi).
- Audit: tiap aksi → `mapel_audit_log`.

### Modul Piket + EWS (`mapelService` SLA + `piketService`)
`buildDailySlaMonitoringRows` / `fetchGuruKosongEws`: jadwal vs check-in → **warning menit ke-16**.
Tugas pengganti (`teacher_absence_task`) → piket tandai `delivered`. `log_piket` catat layanan.

### Modul Pembiasaan (`pembiasaanService`)
Sapa Pagi (perlu `sapa_pagi_schedule`) + Pembiasaan harian.
- Cutoff: sapa 06:30, pembiasaan 07:00 (`pembiasaan_settings`).
- **Geo-fencing**: GPS + foto kamera → cek radius sekolah, tolak di luar radius.
- Weekday-only (Senin–Jumat) + `school_calendar`.
- Auto-alpha via RPC `fn_finalize_auto_alpha`.
- Pola RPC-first, fallback direct insert kalau RLS/permission gagal.
- Laporan eksekutif: kewajiban dinamis (hari aktif × jadwal), scope jurusan untuk kaprog.

### Modul Eksekutif
`fetchExecutiveMapelKpiDataset`, `fetchMapelTeacherPerformance`, audit trail (pagination + export Excel lintas halaman). Scope jurusan via `resolveExecutiveScope`.

## 9. Fitur Lintas-Modul

- **Offline-first** (`mapelSyncQueueService`): absensi/nilai mapel gagal jaringan → antri di localStorage
  (`mapel_sync_queue_v1`); `flushMapelSyncQueue` sinkron ulang + deteksi konflik (base/server/local) anti-duplikasi.
- **Kompresi adaptif** (`compressionPolicy`): tangga 10→15→20→25→30 KB (normal), 40→50 (emergency), >50 gagal.
  Mode ekstrem: grayscale + turun resolusi + strict.
- **PWA**: installable + service worker.
- **Demo mode**: `mockSupabase` — data fiktif, tak sentuh DB (aktif via `VITE_DEMO_MODE` / tombol demo login).

## 10. Skema Database (inferensi dari migrations + query)

- **Inti:** `walikelas` (user), `siswa`, `master_kelas`, `master_mapel`, `absensi`, `log_piket`, `school_calendar`
- **Mapel:** `schedule`, `session`, `class_agenda`, `student_attendance_mapel`, `daily_score`, `teacher_absence_task`, `mapel_audit_log`
- **Pembiasaan:** `pembiasaan_settings`, `sapa_pagi_schedule`, `pembiasaan_attendance`
  + view `vw_riwayat_pembiasaan_detail` + RPC (`fn_submit_sapa_pagi`, `fn_submit_pembiasaan`, `fn_finalize_auto_alpha`)
- **Storage bucket:** `bukti-absen` (foto apel, sesi mapel di folder `kbm/`, pembiasaan di folder `pembiasaan/`)
- Migrations SQL ada di `supabase/migrations/`.

## 11. Temuan / Catatan (kandidat perbaikan, BELUM dikerjakan)

1. **Keamanan auth (prioritas tinggi):** password disimpan plaintext (`.eq('password', password)`);
   auth full client-side pakai anon key → keamanan bergantung penuh pada RLS. Perlu ditinjau/hardening.
2. Bundle `vendor-excel` (exceljs) ~936KB — kandidat lazy-load agar hanya dimuat saat export.
3. Offline-first (Epic E) baru sebagian di modul mapel; modul lain belum.
4. `npm audit`: ada beberapa vulnerability dependency (belum ditinjau).

## 12. Perintah Penting

```bash
npm install          # install dependency
npm run dev          # dev server (localhost:5173) + hot reload
npm run test         # lint + build (GERBANG sebelum deploy)
npm run test:unit    # 95 unit test logika bisnis
npm run build        # build produksi ke dist/
```
