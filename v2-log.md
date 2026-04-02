# V2 Log - Sprint-Ready Backlog

Sumber utama: `v2.md`  
Fokus: Teacher Flow Edition (Modul Guru Mapel, Guru Piket, Kurikulum)

## 1) Scope Ringkas
- Digitalisasi kehadiran guru mapel (check-in/out foto + agenda + absensi siswa).
- Mitigasi `Guru Kosong` berbasis SLA 15 menit.
- Monitoring eksekutif untuk Kurikulum.
- UI modern (shadcn/ui-inspired) tanpa menghilangkan identitas lama.
- Optimasi storage ekstrem untuk Supabase free-tier.
- Offline-first untuk skenario blank spot jaringan.

## 2) Epic dan Task Implementasi

### EPIC A - Foundation, Data Contract, dan Access Control
**Priority:** P0

#### Task A1 - Extend user contract
- Tambah kolom `is_guru_mapel BOOLEAN DEFAULT false` pada tabel `walikelas`.
- Backfill data guru mapel sesuai mapping akun aktif.

**Acceptance Criteria**
- Migrasi berhasil tanpa mengubah enum role existing.
- Akun non-guru-mapel tetap tidak melihat modul mapel.
- Akun multi-role tetap bisa masuk portal pemilihan workspace.

**Dependency**
- Tidak ada.

#### Task A2 - Portal post-login (app switcher)
- Tambah halaman pemilih workspace: `Modul Apel` / `Modul Mapel`.
- Tampilkan opsi berdasarkan role + `is_guru_mapel`.

**Acceptance Criteria**
- User multi-role selalu melihat app switcher setelah login.
- User single-role langsung diarahkan ke modul yang sesuai.
- Redirect aman saat reload/deep-link.

**Dependency**
- A1

#### Task A3 - RLS policy semua tabel baru
- Definisikan policy akses untuk peran: guru mapel, piket, kurikulum.

**Acceptance Criteria**
- Guru mapel hanya bisa ubah data sesi miliknya.
- Piket hanya bisa akses modul distribusi tugas pengganti.
- Kurikulum read-only ke dashboard monitoring dan audit trail.

**Dependency**
- A1

---

### EPIC B - Modul Guru Mapel (Core KBM)
**Priority:** P0

#### Task B1 - Skema data KBM mapel
- Buat tabel: `schedule`, `session`, `class_agenda`, `daily_score`, `student_attendance_mapel`, `teacher_absence_task`.
- Definisikan relasi minimal:
  - `session` terkait `schedule`.
  - `class_agenda` terkait `session`.
  - `student_attendance_mapel` terkait `session` dan siswa.
  - `teacher_absence_task` terkait `session` (status absen guru).

**Acceptance Criteria**
- CRUD dasar berjalan dan tervalidasi foreign key.
- Tidak ada bentrok data dengan tabel `absensi` apel yang existing.

**Dependency**
- A3

#### Task B2 - Jadwal mandiri + validasi bentrok
- Guru membuat jadwal (hari, jam, kelas, mapel).
- Validasi bentrok untuk guru yang sama pada slot waktu overlap.

**Acceptance Criteria**
- Insert jadwal bentrok ditolak dengan pesan yang jelas.
- Edit jadwal juga tervalidasi bentrok.

**Dependency**
- B1

#### Task B3 - Check-in/out foto + kompresi ekstrem
- Update `compressor.js` untuk target <10KB/foto.
- Simpan metadata minimal (timestamp, ukuran file, dimensi akhir).

**Acceptance Criteria**
- Rata-rata ukuran upload <= 10KB dalam kondisi normal.
- Jika gagal capai target, tampilkan error yang jelas dan minta ambil ulang.
- Check-in/out tidak bisa submit tanpa foto valid.

**Dependency**
- B1

#### Task B4 - Agenda sebelum absensi siswa
- Form agenda (topik, metode) wajib diisi sebelum absensi siswa dibuka.

**Acceptance Criteria**
- Tombol absensi siswa disabled sampai agenda valid tersimpan.
- Agenda bisa dilihat ulang dalam audit trail sesi.

**Dependency**
- B1, B3

#### Task B5 - Fast-attendance siswa + QR scanner
- Input status `H/S/I/A` cepat per siswa.
- QR scanner untuk autofokus siswa/kelas saat absensi.

**Acceptance Criteria**
- Input massal tetap responsif untuk kelas besar.
- Hasil absensi tersimpan atomik per sesi.

**Dependency**
- B1, B4

#### Task B6 - Mode "Tidak Masuk" + tugas pengganti
- Guru menandai sesi sebagai tidak masuk.
- Wajib unggah `TeacherAbsenceTask`.

**Acceptance Criteria**
- Status sesi berubah ke `absent` dan mencegah flow check-in/out biasa.
- Tugas pengganti tersimpan dan tersedia untuk modul piket.

**Dependency**
- B1

---

### EPIC C - Modul Guru Piket dan EWS Guru Kosong
**Priority:** P0

#### Task C1 - Engine SLA 15 menit
- Monitoring `schedule` vs `session.check_in`.
- Trigger peringatan jika lewat 15 menit belum check-in.

**Acceptance Criteria**
- Peringatan muncul maksimal pada menit ke-16 dari jam mulai.
- Jika guru check-in setelah warning, status warning berubah resolved.

**Dependency**
- B1, B2, B3

#### Task C2 - Dashboard operasional piket
- Daftar kelas terdampak, status tindak lanjut, dan filter berdasarkan jam.

**Acceptance Criteria**
- Data terurut berdasarkan urgensi waktu.
- Piket dapat menandai progres penanganan per kasus.

**Dependency**
- C1

#### Task C3 - Distribusi tugas pengganti
- Piket unduh tugas pengganti dan centang `delivered_by_picket`.

**Acceptance Criteria**
- Status distribusi tercatat beserta timestamp.
- Hanya tugas untuk sesi absen yang bisa di-deliver.

**Dependency**
- B6, C2

---

### EPIC D - Modul Kurikulum (Executive Monitoring)
**Priority:** P1

#### Task D1 - Teacher performance dashboard
- Metrik: persentase kehadiran guru, rasio keterlambatan.

**Acceptance Criteria**
- Metrik konsisten dengan data session aktual.
- Filter periode (harian/mingguan/bulanan) tersedia.

**Dependency**
- B1, B3, C1

#### Task D2 - Audit trail kelas
- Tampilkan detail KBM: foto check-in/out, agenda, daftar hadir.

**Acceptance Criteria**
- Data audit read-only untuk kurikulum.
- Navigasi ke detail sesi <= 3 klik dari dashboard.

**Dependency**
- D1, B4, B5

---

### EPIC E - Offline-First dan Reliability
**Priority:** P1

#### Task E1 - Offline caching modul mapel
- Cache aset kritikal + queue aksi absensi saat offline.

**Acceptance Criteria**
- Aksi absensi saat offline tersimpan lokal dan sinkron saat online.
- Tidak terjadi duplikasi submit setelah reconnect.

**Dependency**
- B5

#### Task E2 - Conflict handling saat sinkronisasi
- Definisikan strategi konflik untuk data absensi yang diubah lintas device.

**Acceptance Criteria**
- Konflik terdeteksi dan diselesaikan dengan rule konsisten.
- User menerima notifikasi jika data lokalan ditimpa hasil merge.

**Dependency**
- E1

## 3) State Machine `session` (disarankan)
- `scheduled` -> `checked_in` -> `teaching` -> `checked_out` -> `completed`
- Jalur alternatif: `scheduled` -> `absent`

Catatan:
- `teaching` aktif setelah agenda valid.
- `absent` mengunci jalur check-in/out normal.

## 4) Urutan Sprint yang Direkomendasikan
1. Sprint 1: A1-A3, B1-B3 (fondasi + check-in/out aman).
2. Sprint 2: B4-B6, C1-C2 (flow mapel lengkap + EWS jalan).
3. Sprint 3: C3, D1-D2, E1-E2 (operasional, monitoring, offline hardening).

## 5) Risk Log Singkat
- Target foto <10KB berpotensi menurunkan kualitas bukti visual.
- Offline sync berisiko konflik data jika tidak ada idempotency key.
- SLA warning butuh sinkronisasi waktu server yang konsisten.

## 6) Breakdown Sprint 1 (Per File Checklist)
Target Sprint 1: `A1-A3, B1-B3` (fondasi + check-in/out aman)

### 6.1 Role Contract & App Switcher (`A1-A2`)
- `src/app/hooks/useUserRoleFlags.js`
  - [ ] Tambah flag `isGuruMapel`.
  - [ ] Pastikan fallback aman jika kolom belum tersedia.
- `src/shared/constants/roles.js`
  - [ ] Tambah konstanta akses untuk modul mapel (tanpa ubah role lama).
- `src/shared/constants/routes.js`
  - [ ] Tambah route key untuk portal switcher + modul mapel.
- `src/routes/AppRoutes.jsx`
  - [ ] Daftarkan route portal post-login.
  - [ ] Daftarkan route awal modul mapel.
- `src/routes/guards/RequireRole.jsx`
  - [ ] Izinkan kombinasi role + `is_guru_mapel` untuk akses mapel.
- `src/features/auth/pages/LoginPage.jsx`
  - [ ] Redirect pasca-login: multi-role ke app switcher, single-role langsung ke modul.
- `src/features/dashboard/pages/DashboardPage.jsx` (atau page baru)
  - [ ] Implement UI App Switcher (`Modul Apel` vs `Modul Mapel`).

### 6.2 Data Layer & Service Contract (`A3, B1`)
- `src/services/supabase/client.js` dan/atau `src/supabaseClient.js`
  - [ ] Pastikan seluruh query tabel baru terpusat ke client yang sama.
- `src/services/` (disarankan buat file baru `mapelService.js`)
  - [ ] Buat fungsi CRUD untuk:
    - `schedule`
    - `session`
    - `class_agenda`
    - `student_attendance_mapel`
    - `teacher_absence_task`
    - `daily_score` (minimal create/read di Sprint 1).
- `src/services/absensiService.js`
  - [ ] Pisahkan dengan jelas flow apel (`absensi`) vs flow mapel (`student_attendance_mapel`).

Catatan DB migration:
- [ ] Tambahkan berkas SQL migrasi di folder baru `supabase/migrations/`:
  - `add_is_guru_mapel_to_walikelas.sql`
  - `create_mapel_core_tables.sql`
  - `create_rls_policies_mapel.sql`

### 6.3 Jadwal Mandiri + Bentrok (`B2`)
- `src/features/` (disarankan buat modul baru `src/features/mapel/`)
  - [ ] `pages/MapelSchedulePage.jsx`
  - [ ] `components/ScheduleForm.jsx`
  - [ ] `components/ScheduleTable.jsx`
- `src/services/mapelService.js`
  - [ ] Implement `validateScheduleConflict(teacherId, day, start, end)`.
  - [ ] Reject insert/update bentrok dengan pesan domain-friendly.

### 6.4 Check-in/out Foto + Kompresi (`B3`)
- `src/shared/utils/compressor.js`
  - [ ] Tambah mode kompresi ekstrem (<10KB) dengan batas minimum resolusi.
  - [ ] Kembalikan metadata: ukuran akhir, dimensi akhir, kualitas akhir.
- `src/services/supabase/storageService.js`
  - [ ] Upload foto check-in/out ke bucket terpisah (nama path terstruktur by sessionId).
- `src/features/mapel/pages/MapelSessionPage.jsx` (baru)
  - [ ] Tombol check-in/out wajib foto.
  - [ ] Tampilkan error eksplisit jika ukuran final > target atau kompresi gagal.

### 6.5 Definition of Done Sprint 1
- [ ] Multi-role user berhasil melihat app switcher setelah login.
- [ ] Tabel core mapel + RLS aktif dan query service berjalan.
- [ ] Guru dapat membuat jadwal tanpa bentrok.
- [ ] Guru dapat check-in/out dengan foto terkompresi dan tersimpan.
- [ ] Tidak ada regresi pada flow apel lama (`absensi`).

## 7) Urutan Implementasi Harian (Sprint 1)
Tujuan section ini: memberi alur eksekusi tim yang minim blocking.

### Day 1 - Role Contract + Routing Foundation
- Fokus:
  - `A1` (role contract) dan baseline `A2`.
- Eksekusi:
  - Update role flags di `src/app/hooks/useUserRoleFlags.js`.
  - Tambah konstanta akses dan route key di:
    - `src/shared/constants/roles.js`
    - `src/shared/constants/routes.js`
  - Daftarkan route portal dan entry mapel di `src/routes/AppRoutes.jsx`.
- Output:
  - Multi-role bisa diarahkan ke jalur app switcher (skeleton route siap).

### Day 2 - App Switcher UX + Guard Enforcement
- Fokus:
  - Selesaikan `A2` + awal `A3` (guard logic).
- Eksekusi:
  - Implement UI app switcher (di `DashboardPage` atau page baru).
  - Atur redirect pasca-login di `src/features/auth/pages/LoginPage.jsx`.
  - Perkuat gate akses di `src/routes/guards/RequireRole.jsx` berbasis role + `is_guru_mapel`.
- Output:
  - Alur login stabil untuk single-role dan multi-role.

### Day 3 - DB Core Mapel + Service Contract
- Fokus:
  - `A3` dan `B1` (fondasi data).
- Eksekusi:
  - Tambah migration SQL:
    - `supabase/migrations/add_is_guru_mapel_to_walikelas.sql`
    - `supabase/migrations/create_mapel_core_tables.sql`
    - `supabase/migrations/create_rls_policies_mapel.sql`
  - Buat/rapikan `src/services/mapelService.js`.
  - Pastikan client Supabase tunggal dipakai konsisten.
- Output:
  - Tabel dan policy siap dipakai oleh layer UI.

### Day 4 - Jadwal Mandiri + Validasi Bentrok
- Fokus:
  - `B2`.
- Eksekusi:
  - Buat halaman dan komponen jadwal:
    - `src/features/mapel/pages/MapelSchedulePage.jsx`
    - `src/features/mapel/components/ScheduleForm.jsx`
    - `src/features/mapel/components/ScheduleTable.jsx`
  - Implement `validateScheduleConflict(...)` di service.
- Output:
  - Guru bisa CRUD jadwal tanpa slot bentrok.

### Day 5 - Check-in/out Foto + Kompresi Ekstrem
- Fokus:
  - `B3`.
- Eksekusi:
  - Upgrade `src/shared/utils/compressor.js` untuk target <10KB.
  - Integrasi upload di `src/services/supabase/storageService.js`.
  - Implement flow check-in/out di `src/features/mapel/pages/MapelSessionPage.jsx`.
- Output:
  - Check-in/out berbasis foto berjalan end-to-end.

### Day 6 - Integrasi, Regression Check, dan Hardening
- Fokus:
  - Stabilitas lintas modul.
- Eksekusi:
  - Uji alur lengkap: login -> switcher -> jadwal -> check-in/out.
  - Uji regresi modul apel lama (`absensi`) tetap normal.
  - Rapikan error message domain (bentrok jadwal, gagal kompres, gagal upload).
- Output:
  - Siap merge untuk cakupan Sprint 1.

### Gate Review Akhir Sprint 1
- Lulus semua item `6.5 Definition of Done Sprint 1`.
- Tidak ada blocker kritikal di role access, validasi bentrok, dan upload foto.

## 8) Sprint 1 Execution Board (Siap Assign PIC)
Petunjuk cepat:
- Isi kolom **PIC** (nama/inisial tim).
- Update **Status** harian: `Todo` -> `Doing` -> `Review` -> `Done`.
- Isi **Catatan** jika ada blocker atau keputusan teknis.
- Default saat ini: **PIC semua item = Kamu (solo developer)**.

| ID | Work Item | File/Area Utama | Dependency | PIC | Status | Catatan |
|---|---|---|---|---|---|---|
| S1-01 | Tambah flag `isGuruMapel` pada role hook | `src/app/hooks/useUserRoleFlags.js` | - | Kamu | Done | Selesai: fallback boolean aman untuk nilai `boolean/number/string`. |
| S1-02 | Tambah konstanta akses modul mapel | `src/shared/constants/roles.js` | S1-01 | Kamu | Done | Tambah `MAPEL_ACCESS_ROLES`, `normalizeBooleanFlag`, dan `isMapelAccessRole`; validasi via task agent. |
| S1-03 | Tambah route key app switcher + mapel | `src/shared/constants/routes.js` | S1-02 | Kamu | Done | Tambah `APP_SWITCHER_ROUTE` dan `MAPEL_DASHBOARD_ROUTE`. |
| S1-04 | Daftarkan route portal & mapel | `src/routes/AppRoutes.jsx` | S1-03 | Kamu | Done | Route `APP_SWITCHER_ROUTE` dan `MAPEL_DASHBOARD_ROUTE` sudah aktif. |
| S1-05 | Perkuat guard role + `is_guru_mapel` | `src/routes/guards/RequireRole.jsx` | S1-04 | Kamu | Done | Guard mapel pakai `canAccessMapel` (role + `is_guru_mapel`). |
| S1-06 | Redirect login single/multi role | `src/features/auth/pages/LoginPage.jsx` | S1-05 | Kamu | Done | Redirect berbasis `dashboardLink`: multi-workspace -> portal, single-workspace -> route modul. |
| S1-07 | Implement UI App Switcher | `DashboardPage` / page baru | S1-06 | Kamu | Done | Tambah `PortalWorkspacePage` + guard multi-workspace. |
| S1-08 | Migrasi kolom `is_guru_mapel` | `supabase/migrations/*.sql` | S1-01 | Kamu | Done | Tambah file `add_is_guru_mapel_to_walikelas.sql` (idempotent, default `false`). |
| S1-09 | Buat tabel core mapel | `supabase/migrations/*.sql` | S1-08 | Kamu | Done | Tambah `create_mapel_core_tables.sql`; **schema inti juga sudah dibuat manual di DB production oleh kamu** (jadi acuan lanjutan). |
| S1-10 | Buat policy RLS mapel | `supabase/migrations/*.sql` | S1-09 | Kamu | Done | Tambah `create_mapel_rls_policies.sql` (adaptif `teacher_id/guru_id`, siap role guru/piket/kurikulum berbasis JWT claim). |
| S1-11 | Bangun `mapelService` (CRUD inti) | `src/services/mapelService.js` | S1-09 | Kamu | Done | `mapelService.js` selesai: CRUD jadwal/sesi/agenda/absensi mapel/nilai/tugas pengganti sesuai schema live. |
| S1-12 | Validasi bentrok jadwal | `src/services/mapelService.js` + UI jadwal | S1-11 | Kamu | Done | Tambah `validateScheduleConflict` + auto-check di `createSchedule/updateSchedule`; pesan bentrok domain-friendly. |
| S1-13 | Halaman + komponen jadwal mapel | `src/features/mapel/*` | S1-12 | Kamu | Done | Tambah `MapelSchedulePage`, `ScheduleForm`, `ScheduleTable`, plus wiring route `MAPEL_SCHEDULE_ROUTE`. |
| S1-14 | Upgrade kompresi foto <10KB | `src/shared/utils/compressor.js` | S1-11 | Kamu | Done | Tambah `compressImageExtreme` + metadata (`compressImageWithMeta`), tanpa fallback silent saat mode strict. |
| S1-15 | Integrasi upload foto check-in/out | `src/services/supabase/storageService.js` | S1-14 | Kamu | Done | Tambah `uploadMapelSessionPhoto` dengan path `kbm/{sessionId}/{phase}-{timestamp}.jpg`. |
| S1-16 | Implement flow sesi mapel check-in/out | `src/features/mapel/pages/MapelSessionPage.jsx` | S1-15 | Kamu | Done | Tambah halaman sesi mapel + kompresi ekstrem + upload storage + update status check-in/out + gate agenda sebelum QR + absensi manual klik sebagai flow utama. |
| S1-17 | Regression check modul apel lama | `src/services/absensiService.js` + flow UI lama | S1-16 | Kamu | Done | Build lulus; caller `compressImage/uploadBuktiAbsen` di flow apel/piket tidak menambah error baru. |

### Kriteria Lulus Board
- Semua item `S1-01` s.d `S1-17` berstatus `Done`.
- Tidak ada blocker terbuka pada item berdependency kritikal (`S1-10`, `S1-14`, `S1-16`).

## 9) Post Sprint 1 - Manual Attendance Hardening
- Absensi mapel manual klik ditegaskan sebagai flow utama operasional.
- Halaman sesi mapel ditingkatkan dengan:
  - Ringkasan progres status (`H/S/I/A` + total terisi).
  - Pencarian cepat siswa (nama/NIS).
  - Filter status.
  - Aksi massal: `Set Semua H/S/I/A` dan `Clear Visible`.
- QR scanner tetap opsional (placeholder) sampai kesiapan implementasi berikutnya.

## 10) Auth Session Hardening (Step 1-5)
- Session contract lokal distandarkan dengan payload:
  - `role`
  - `walikelas_id` (sama dengan `id`)
  - `is_guru_mapel`
- Data session dipersist di `localStorage` via `sessionService` agar reload/deep-link tetap aman.
- Guard auth diperketat:
  - `RequireAuth` kini cek state login + validitas session storage.
- Service layer mapel diberi validasi berlapis:
  - cek akses mapel
  - cek ownership guru/sesi untuk non-admin
  - cegah akses data guru lain dari request tampered.
- Regression check:
  - build lulus
  - tidak ada error baru pada file auth/session hardening.

## 11) Lint Legacy Cleanup
- Error lint legacy pada modul admin/dashboard/monitoring/piket sudah dibersihkan.
- Hasil lint terbaru: **0 error**, tersisa warning `react-hooks/exhaustive-deps`.
- Build tetap lulus setelah cleanup.

## 12) Lint Warning Cleanup (Exhaustive Deps)
- Warning `react-hooks/exhaustive-deps` sudah dirapikan pada page absensi, dashboard, monitoring, dan piket.
- Hasil validasi terbaru:
  - `npm run lint` lulus.
  - `npm run build` lulus.
- Catatan lingkungan: Vite menampilkan warning versi minor Node (`22.10.0` vs rekomendasi `22.12+`), namun proses build tetap sukses.

## 13) Sprint 2 - Audit Log Mapel (Implemented)
- Audit log aksi guru mapel sudah diimplementasikan di service layer untuk event:
  - `agenda_submit`
  - `session_check_in`
  - `session_check_out`
  - `attendance_manual_save`
- Semua event dicatat ke tabel `public.mapel_audit_log` beserta metadata aksi (source, count status, timestamp hasil update).
- UI sesi mapel sekarang mengirim context actor (`actorName`) saat submit agenda, check-in/out foto, dan simpan absensi manual.
- Migration repo ditambahkan:
  - `supabase/migrations/create_mapel_audit_log_table.sql`
  - update policy di `supabase/migrations/create_mapel_rls_policies.sql` untuk akses select/insert audit log.
- Validasi pasca implementasi:
  - `npm run lint` lulus.
  - `npm run build` lulus.

## 14) Sprint 3 - Kurikulum Audit Trail Page (Implemented)
- Halaman audit trail kurikulum sudah ditambahkan: `src/features/mapel/pages/MapelAuditTrailPage.jsx`.
- Service query audit trail ditambahkan: `fetchMapelAuditTrail(...)` di `src/services/mapelService.js`, termasuk enrich context sesi/jadwal/mapel/kelas.
- Route baru ditambahkan:
  - `MAPEL_AUDIT_ROUTE = /mapel/audit`
  - wiring di `src/routes/AppRoutes.jsx` dengan guard `isExec || isAdmin`.
- Navigasi ditambahkan:
  - Quick link pada `MapelHomePage` untuk role executive/admin.
  - Menu sidebar `Audit Trail Mapel` di `AppShell` untuk executive/admin.
- Filter halaman audit:
  - rentang tanggal
  - jenis aksi
  - actor id (opsional)
- Validasi pasca implementasi:
  - `npm run lint` lulus.
  - `npm run build` lulus.

## 15) Sprint 4 - Audit Trail Excel Export Only (Implemented)
- Export audit trail ditambahkan **khusus format Excel (`.xlsx`)** di `MapelAuditTrailPage`.
- Tombol baru: `Export Excel (.xlsx)` hanya aktif saat data hasil filter tersedia.
- Data export mengikuti filter aktif (rentang tanggal, aksi, actor id) dan memuat kolom utama:
  - waktu log, tanggal/status sesi, aksi, actor, kelas, mapel, jam, metadata.
- Tidak ditambahkan export CSV sesuai keputusan produk.
- Validasi pasca implementasi:
  - `npm run lint` lulus.
  - `npm run build` lulus.

## 16) Sprint 5 - Preset Filter Audit Trail (Implemented)
- Halaman audit trail ditingkatkan dengan preset rentang tanggal cepat:
  - `Hari Ini`
  - `7 Hari`
  - `30 Hari`
- Preset mengisi otomatis `fromDate` dan `toDate`, lalu data tetap dimuat melalui alur filter existing.
- Export Excel tetap mengikuti filter aktif setelah preset dipilih.
- Validasi pasca implementasi:
  - `npm run lint` lulus.
  - `npm run build` lulus.

## 17) Sprint 6 - Pagination Audit Trail (Implemented)
- Query audit trail kini mendukung pagination server-side (`page`, `pageSize`) + total count.
- UI audit trail ditambahkan:
  - selector `Baris / halaman` (10/25/50/100),
  - indikator total data hasil filter,
  - navigator halaman `Prev/Next`.
- Perubahan filter akan otomatis reset ke halaman 1 agar data konsisten.
- Export Excel tetap berjalan untuk data pada halaman aktif.
- Validasi pasca implementasi:
  - `npm run lint` lulus.
  - `npm run build` lulus.

## 18) Sprint 7 - Export Excel Lintas Halaman (Implemented)
- Export Excel audit trail ditingkatkan agar mengambil **seluruh data sesuai filter aktif** (bukan hanya halaman yang sedang ditampilkan).
- Mekanisme export:
  - ambil page 1 untuk mendapatkan `totalPages`,
  - fetch berurutan semua halaman,
  - gabungkan seluruh baris hasil filter ke satu file `.xlsx`.
- UI pagination tetap dipakai untuk tampilan harian, sedangkan export tetap full sesuai filter.
- Validasi pasca implementasi:
  - `npm run lint` lulus.
  - `npm run build` lulus.

## 19) Sprint 8 - Filter Audit per Kelas/Mapel (Implemented)
- Audit trail kini mendukung filter lanjutan:
  - `Kelas` (dropdown master_kelas)
  - `Mapel` (dropdown master_mapel)
- Filter diterapkan di query service (bukan sekadar client-side), sehingga:
  - pagination tetap akurat,
  - total count tetap konsisten,
  - export Excel lintas halaman ikut filter kelas/mapel aktif.
- Ditambahkan service helper `fetchMapelAuditFilterOptions()` untuk preload opsi filter sesuai role audit global.
- Validasi pasca implementasi:
  - `npm run lint` lulus.
  - `npm run build` lulus.

## 20) Sprint 9 - Filter Guru Autocomplete (Implemented)
- Filter guru di audit trail ditingkatkan menjadi alur autocomplete:
  - input pencarian `nama/ID`,
  - dropdown actor hasil pencarian untuk memilih `actor_id` yang valid.
- Ditambahkan service `searchMapelAuditActors(...)` berbasis data `mapel_audit_log` dengan dedup per actor agar opsi tetap bersih.
- Filter actor tetap diterapkan di query-level (`actor_id`) sehingga sinkron dengan:
  - pagination,
  - total count,
  - export Excel lintas halaman.
- Validasi pasca implementasi:
  - `npm run lint` lulus.
  - `npm run build` lulus.

## 21) Sprint 10 - QR Scanner Opsional (Implemented)
- QR scanner real camera diaktifkan pada `MapelSessionPage` menggunakan `html5-qrcode`.
- Prinsip flow dipertahankan:
  - **manual klik tetap flow utama**,
  - QR hanya opsi tambahan untuk mempercepat pengisian status.
- Mekanisme QR:
  - scanner hanya bisa dibuka jika agenda sudah submit dan sesi aktif,
  - mode status scan dapat dipilih (`H/S/I/A`),
  - hasil scan memetakan siswa via `id` atau `nis` (mendukung payload text/JSON sederhana),
  - hasil scan mengisi `attendanceDraft` tanpa langsung menimpa save flow manual.
- Fallback aman:
  - jika kamera tidak tersedia / gagal start, tampilkan error dan user tetap lanjut manual.
- Validasi pasca implementasi:
  - `npm run lint` lulus.
  - `npm run build` lulus.

## 22) Sprint 11 - Security & Reliability Hardening (Implemented)
- Migrasi library Excel selesai dari `xlsx` ke `exceljs` untuk menutup temuan vulnerability tanpa fix pada `xlsx`.
- Shared helper baru dipakai lintas fitur:
  - `src/services/shared/excelService.js`
  - `exportJsonToExcel(...)`
  - `readExcelFileToJson(...)`
- Flow yang sudah dipindahkan ke helper baru:
  - import user admin,
  - import/export siswa admin,
  - export akumulasi siswa,
  - export dashboard executive,
  - export audit trail mapel.
- Hardening auth session ditingkatkan di `sessionService`:
  - tambah `issued_at`, `expires_at`, `session_version`,
  - TTL session 12 jam,
  - auto-rotate expiry saat sesi valid diakses,
  - session kadaluarsa/invalid version otomatis di-clear.
- Baseline test gate ditambahkan:
  - script `npm test` sekarang menjalankan `npm run lint && npm run build`.
- Validasi pasca implementasi:
  - `npm run lint` lulus.
  - `npm run build` lulus.
  - `npm test` lulus.
  - `npm audit --omit=dev --audit-level=moderate` lulus (0 vulnerability).

## 23) Sprint 12 - Node Baseline & Bundle Split (Implemented)
- Baseline runtime Node dikunci di level project:
  - `.nvmrc` ditambahkan dengan target `22.12.0`.
  - `package.json` ditambahkan `engines.node: ">=22.12.0"`.
- Optimasi split bundle ditambahkan di `vite.config.js` via `rollupOptions.output.manualChunks`:
  - `vendor-excel` (`exceljs`)
  - `vendor-qr` (`html5-qrcode`)
  - `vendor-chart` (`recharts`)
  - `vendor-supabase` (`@supabase/*`)
  - `vendor-core` (sisa dependency pihak ketiga)
- Dampak build:
  - entry app utama turun menjadi sekitar `177 kB` (minified),
  - dependency berat terpisah ke chunk vendor masing-masing.
- Validasi pasca implementasi:
  - `npm run lint` lulus.
  - `npm run build` lulus.
  - `npm test` lulus.
- Catatan:
  - warning Node Vite masih muncul di environment saat ini karena runtime aktif masih `22.10.0`; akan hilang setelah environment benar-benar memakai `22.12.0+`.

## 24) Sprint 13 - UI Foundation Refresh (Shadcn-Style, Blue Brand) (Implemented)
- Fondasi visual baru ditambahkan tanpa mengganti identitas warna biru aplikasi.
- Penambahan style token global di `src/index.css`:
  - palet brand biru,
  - `app-texture` untuk background premium halus,
  - `premium-card` untuk elevasi card bergaya modern.
- App shell direvamp di `src/app/AppShell.jsx`:
  - sidebar + header modern (glass + border soft),
  - state aktif menu lebih jelas (pill biru),
  - section navigation lebih rapi dan konsisten,
  - panel user + tombol aksi lebih clean.
- Komponen dasar reusable ditambahkan:
  - `src/shared/ui/Button.jsx`
  - `src/shared/ui/Card.jsx`
  - `src/shared/ui/InputField.jsx`
  - `src/shared/ui/cn.js`
- Halaman login di-refresh agar konsisten dengan fondasi baru:
  - card modern,
  - input dan button reusable,
  - hierarki tipografi lebih premium.
- Integrasi CSS global:
  - `src/main.jsx` sekarang import `src/index.css`.
- Validasi pasca implementasi:
  - `npm run lint` lulus.
  - `npm run build` lulus.
  - `npm test` lulus.

## 25) Sprint 14 - Full Rollout Prep + Dark/Light Theme System (Implemented)
- Theme mode global ditambahkan dengan persistensi localStorage:
  - hook baru `src/app/hooks/useThemeMode.js`.
  - apply ke level root via `data-theme` + `color-scheme`.
- Toggle dark/light mode ditambahkan di app header (`AppShell`) untuk akses cepat seluruh user login.
- State dark mode lokal pada Executive dashboard dihapus agar tidak konflik dengan theme global.
- Global style rollout diperluas melalui `src/index.css`:
  - dark theme token set,
  - adaptasi permukaan (`bg-*`), teks (`text-*`), border (`border-*`) yang paling sering dipakai,
  - memastikan halaman lama ikut beradaptasi tanpa rewrite total per halaman.
- Hasil: fondasi premium (shadcn-like) kini konsisten lintas shell/login/dashboard/admin/mapel/piket dengan identitas biru tetap dipertahankan.
- Validasi pasca implementasi:
  - `npm run lint` lulus.
  - `npm run build` lulus.
  - `npm test` lulus.

## 26) Sprint 15 - Global UI Polish Rollout (Implemented)
- Rollout visual premium dilanjutkan ke halaman inti operasional.
- Primitive layout baru ditambahkan:
  - `src/shared/ui/PageLayout.jsx` (`PageContainer`, `PageHeader`, `PageTitle`, `PageSubtitle`).
- Halaman yang dipoles agar konsisten dengan design system:
  - `DashboardPage` (admin + walas sections),
  - `ExecutiveDashboardPage` (header/structure refinements),
  - `PiketDashboardPage` (header + stat cards pakai surface card),
  - `ManajemenUserPage` (header/actions/form/table surfaces),
  - `MapelHomePage` (hero card + CTA buttons),
  - `HalamanAbsenPage` (header + list cards + sticky save action).
- Komponen reusable yang dipakai ulang pada rollout:
  - `Button`, `Card`, `InputField`, `PageLayout`.
- Validasi pasca implementasi:
  - `npm run lint` lulus.
  - `npm run build` lulus.
  - `npm test` lulus.

## 27) Sprint 16 - Remaining Pages Polish Rollout (Implemented)
- Polishing dilanjutkan ke halaman tersisa agar visual premium konsisten lebih luas.
- Halaman admin yang dipoles:
  - `ManajemenKelasPage` (header, filter surface, form card, CTA button),
  - `ManajemenSiswaPage` (hapus dark-mode lokal, sinkron ke theme global, refine action/header).
- Halaman mapel yang dipoles:
  - `MapelSessionPage` (layout card + action button konsisten),
  - `MapelAuditTrailPage` (header/card/filter/export memakai primitive baru).
- Halaman piket yang dipoles:
  - `PiketInputPage` (header, form/filter surface, search action),
  - `RekapPiketPage` (header + summary cards + layout consistency).
- Primitive yang dipakai:
  - `PageLayout`, `Button`, `Card`, `InputField`.
- Validasi pasca implementasi:
  - `npm run lint` lulus.
  - `npm run build` lulus.
  - `npm test` lulus.

## 28) Sprint 17 - Micro Polish Pass (Implemented)
- Dilakukan micro-polish untuk halaman data-dense agar rasa premium lebih halus.
- Penambahan utilitas global di `src/index.css`:
  - `.premium-table` (kepadatan tabel, header readability, hover row konsisten),
  - `.micro-loading` (loading copy style lebih clean dan konsisten).
- Halaman yang disesuaikan:
  - `ManajemenUserPage` (table header/spacing + loading copy),
  - `ManajemenSiswaPage` (table density diselaraskan),
  - `RekapPiketPage` (table readability + loading copy),
  - `MapelAuditTrailPage` (loading state copy pada data list).
- Hasil:
  - keterbacaan tabel meningkat,
  - transisi hover lebih konsisten antar halaman,
  - feedback loading lebih premium dan seragam.
- Validasi pasca implementasi:
  - `npm run lint` lulus.
  - `npm run build` lulus.
  - `npm test` lulus.

## 29) Sprint 18 - Admin Visual Feedback Fix (Implemented)
- Menindaklanjuti feedback visual dari screenshot `ss/1.png` untuk area admin shell.
- Perbaikan di `src/app/AppShell.jsx`:
  - **Header cleanup**: menghapus teks strip atas (`JINGGA ASIK` + `Presensi Digital Sekolah`) agar header lebih clean sesuai request.
  - **Dark mode header fix**: background/border header kini adaptif dark/light sehingga tidak muncul area putih kontras saat dark mode.
  - **Sidebar admin cleanup**: panel boxed khusus `Admin Panel` dihilangkan, kembali ke section list yang lebih rapi.
  - **Responsive bottom fix**: layout sidebar diubah ke `flex` + `nav flex-1 min-h-0 overflow-y-auto` supaya konten bawah tidak terpotong pada viewport pendek.
- Validasi pasca implementasi:
  - `npm run lint` lulus.
  - `npm run build` lulus.
  - `npm test` lulus.

## 30) Sprint 19 - Dark Dropdown Contrast Fix (Implemented)
- Menindaklanjuti feedback dark mode pada halaman `User & Akses` (form tambah user) bahwa dropdown role terlihat ghost.
- Perbaikan:
  - `src/index.css`: menambahkan style khusus dark mode untuk `select option/optgroup` agar background opsi gelap dan teks terang (kontras stabil saat dropdown dibuka).
  - `src/features/admin/pages/ManajemenUserPage.jsx`: merapikan style field `Role` jadi surface netral (`bg-white + border`) agar ikut konsisten dengan global dark override.
- Hasil:
  - teks opsi role sekarang tetap terbaca jelas di dark mode.
- Validasi pasca implementasi:
  - `npm run lint` lulus.
  - `npm run build` lulus.
  - `npm test` lulus.

## 31) Sprint 20 - Manajemen Akun Selaras Logic Guru Mapel V2 (Implemented)
- Menyelaraskan halaman `Manajemen Akun` dengan model akses V2 berbasis flag `is_guru_mapel`.
- Perbaikan di `src/features/admin/pages/ManajemenUserPage.jsx`:
  - Form tambah/ubah akun menambah toggle **Aktifkan Akses Guru Mapel** (`is_guru_mapel`).
  - Payload simpan/update kini ikut mengirim `is_guru_mapel`.
  - Import Excel user kini mendukung kolom `is_guru_mapel` / `guru_mapel` (boolean parsing robust).
  - Tabel user menampilkan badge tambahan **Guru Mapel** agar audit akses lebih jelas.
- Hasil:
  - admin bisa mengelola akses workspace mapel langsung dari manajemen akun sesuai logic sprint V2.
- Validasi pasca implementasi:
  - `npm run lint` lulus.
  - `npm run build` lulus.
  - `npm test` lulus.

## 32) Sprint 21 - RBAC V2 Section 5 Realignment (Implemented)
- Menyelaraskan akses role berdasarkan `v2.md` bagian **Matriks Akses & Navigasi Menu (RBAC V2)**.
- Perubahan utama:
  - Admin difokuskan ke **pengelolaan data** (menu admin panel), tanpa fallback ke operasional walas/piket.
  - Akses `Audit Trail Mapel` dibatasi hanya untuk: `kepsek`, `kaprog`, `kurikulum`.
  - Role `kurikulum` dimasukkan ke kelompok executive untuk `Executive Control`.
  - Akses modul mapel berbasis trigger `is_guru_mapel` (bukan role `admin`).
- Perubahan teknis:
  - `src/shared/constants/roles.js`:
    - tambah `MAPEL_AUDIT_ROLES`,
    - `EXECUTIVE_ROLES` kini mencakup `kurikulum`,
    - `MAPEL_ACCESS_ROLES` dikosongkan (flag-based access).
  - `useUserRoleFlags`, `App.jsx`, `AppShell.jsx`, `AppRoutes.jsx` disinkronkan ke capability baru (`canAccessMapelAudit`) dan guard route baru.
  - `mapelService` (audit list/filter/actor search) disinkronkan ke role audit baru.
  - `ManajemenUserPage`:
    - opsi role diperluas sesuai RBAC V2 (`guru`, `walikelas`, `piket`, `admin`, `kaprog`, `kepsek`, `kesiswaan`, `kurikulum`),
    - normalisasi role import agar user tanpa jabatan tidak dipaksa jadi walikelas.
  - `ExecutiveDashboardPage` diselaraskan untuk akses global `kurikulum`.
- Validasi pasca implementasi:
  - `npm run lint` lulus.
  - `npm run build` lulus.
  - `npm test` lulus.

## 33) Sprint 22 - Admin Manajemen Mata Pelajaran (Implemented)
- Menambahkan capability admin untuk mengelola `master_mapel` agar dipakai sebagai sumber dropdown pada jadwal mandiri guru mapel.
- Perubahan:
  - `src/features/admin/pages/ManajemenMapelPage.jsx` ditambahkan (CRUD mapel: tambah, ubah, hapus).
  - `src/routes/AppRoutes.jsx`:
    - route baru `/manajemen-mapel` (admin-only).
  - `src/app/AppShell.jsx`:
    - menu baru di Admin Panel: `Mata Pelajaran`.
- Dampak:
  - admin kini bisa maintain data mapel dari UI tanpa SQL manual,
  - guru mapel otomatis melihat daftar mapel terbaru saat menyusun jadwal (`MapelSchedulePage` memakai `fetchMasterMapel`).
- Validasi pasca implementasi:
  - `npm run lint` lulus.
  - `npm run build` lulus.
  - `npm test` lulus.

## 34) Sprint 23 - Import Excel + Template Mapel (Implemented)
- Menambahkan alur bulk input mapel agar admin tidak input satu-satu.
- Perubahan di `src/features/admin/pages/ManajemenMapelPage.jsx`:
  - Tombol **Template** untuk unduh `template_import_mapel.xlsx` (kolom: `nama_mapel`, `kode_mapel`).
  - Tombol **Import Excel** (`.xlsx`) untuk proses massal mapel.
  - Parsing & normalisasi data import (uppercase, validasi `nama_mapel`, dedupe baris import).
  - Mekanisme sinkronisasi:
    - update jika mapel sudah ada (prioritas cocok `kode_mapel`, fallback `nama_mapel`),
    - insert jika belum ada.
  - Feedback hasil import menampilkan jumlah baris diproses + rincian update/insert.
- Dampak:
  - onboarding data mapel jauh lebih cepat dan konsisten dengan template standar.
- Validasi pasca implementasi:
  - `npm run lint` lulus.
  - `npm run build` lulus.
  - `npm test` lulus.

## 35) Sprint 24 - Fix Entry Routing Sesuai ALUR V2 (Implemented)
- Menyesuaikan flow pasca-login agar konsisten dengan bagian `## ALUR` di `v2.md`.
- Perbaikan:
  - `src/routes/AppRoutes.jsx`:
    - akses ke `/dashboard` kini otomatis redirect ke `/portal` untuk user multi-workspace,
    - user mapel-only otomatis redirect dari `/dashboard` ke `/mapel`.
  - `src/app/hooks/useUserRoleFlags.js`:
    - kompatibilitas role `guru/guru_mapel` diperlakukan sebagai akses mapel.
  - `src/services/auth/sessionService.js`:
    - akses modul mapel tidak lagi membuka bypass admin,
    - ownership guru pada data mapel diperketat (tanpa pengecualian admin).
- Dampak:
  - guru mapel-only masuk ke dashboard mapel,
  - guru mapel dengan tugas tambahan masuk app switcher terlebih dulu,
  - alur login sekarang konsisten dengan RBAC Source of Truth.
- Validasi pasca implementasi:
  - `npm run lint` lulus.
  - `npm run build` lulus.
  - `npm test` lulus.

## 36) Sprint 25 - Isolasi Halaman Portal Workspace (Implemented)
- Menindaklanjuti feedback UX bahwa portal tidak boleh "bocor" layout dashboard.
- Perbaikan:
  - `src/App.jsx`:
    - portal route (`/portal`) sekarang dirender tanpa `AppShell` (tanpa sidebar/header),
    - route selain portal tetap memakai `AppShell` normal.
  - `src/features/dashboard/pages/PortalWorkspacePage.jsx`:
    - layout diubah jadi halaman full-screen fokus pemilihan workspace.
- Dampak:
  - Portal benar-benar menjadi halaman transisi khusus pilih workspace, tidak terasa seperti dashboard.
- Validasi pasca implementasi:
  - `npm run lint` lulus.
  - `npm run build` lulus.
  - `npm test` lulus.

## 37) Sprint 26 - Context-Aware Workspace untuk Executive (Implemented)
- Menyelaraskan perilaku setelah memilih workspace dari portal agar konteks menu tidak campur.
- Perbaikan:
  - `src/app/AppShell.jsx`:
    - sidebar kini membaca context route (`/mapel` vs non-mapel),
    - saat di workspace mapel, menu utama menjadi `Dashboard Mapel` + section `Modul Mapel` (`Jadwal Mengajar`, `Sesi & Absensi`),
    - `Audit Trail Mapel` hanya ditampilkan pada workspace manajemen (bukan saat sedang di workspace mapel).
  - `src/App.jsx`:
    - meneruskan capability `canAccessMapel` ke `AppShell` untuk render menu kontekstual.
- Dampak:
  - Executive pilih **Manajemen** -> fokus ke dashboard executive + audit trail mapel.
  - Executive pilih **Modul Mapel** -> fokus ke dashboard/mapel flow terpisah.
- Validasi pasca implementasi:
  - `npm run lint` lulus.
  - `npm run build` lulus.
  - `npm test` lulus.

## 38) Sprint 27 - Nilai Harian Guru Mapel (Implemented)
- Menambahkan fitur input nilai harian langsung dari workspace mapel.
- Perubahan utama:
  - `src/shared/constants/routes.js`:
    - route baru `MAPEL_SCORE_ROUTE` (`/mapel/nilai`).
  - `src/app/AppShell.jsx`:
    - menu sidebar `Nilai Harian` ditambahkan pada section `Modul Mapel`.
  - `src/routes/AppRoutes.jsx`:
    - route mapel baru dihubungkan ke halaman `MapelScorePage`.
  - `src/features/mapel/pages/MapelScorePage.jsx` (baru):
    - filter tanggal + sesi,
    - load siswa aktif berdasarkan kelas sesi,
    - load nilai existing per sesi (`fetchDailyScoreBySession`),
    - input nilai + catatan per siswa,
    - validasi nilai rentang `0-100`,
    - simpan massal ke `daily_score` via `upsertDailyScore`.
  - `src/features/mapel/pages/MapelHomePage.jsx`:
    - quick action `Input Nilai Harian` ditambahkan.
- Dampak:
  - guru mapel kini punya alur lengkap dari sesi/absensi ke input nilai tanpa keluar dari workspace mapel.
- Validasi pasca implementasi:
  - `npm run lint` lulus.
  - `npm run build` lulus.
  - `npm test` lulus.

## 39) Sprint 28 - Save Per-Row Nilai Harian (Implemented)
- Menambahkan UX simpan cepat per siswa pada halaman `Nilai Harian`.
- Perubahan:
  - `src/features/mapel/pages/MapelScorePage.jsx`:
    - kolom aksi baru dengan tombol `Simpan` per baris,
    - status loading per baris (`Menyimpan...`) agar tidak mengunci seluruh tabel,
    - indikator `Tersimpan` setelah sukses simpan per siswa,
    - indikator `Tersimpan` otomatis reset saat nilai/catatan siswa tersebut diubah lagi.
- Validasi:
  - tetap memakai validasi nilai `0-100` yang sama dengan simpan massal.
- Validasi pasca implementasi:
  - `npm test` lulus.

## 40) Sprint 29 - Auto-Save Debounce + Rekap Nilai Sesi (Implemented)
- Menambahkan auto-save berbasis debounce agar input nilai lebih cepat tanpa harus klik simpan berulang.
- Perubahan:
  - `src/features/mapel/pages/MapelScorePage.jsx`:
    - auto-save per baris dengan delay `900ms` setelah perubahan nilai/catatan,
    - status row-level untuk `Menyimpan...`, `Tersimpan`, dan `Auto-save gagal`,
    - cleanup timer debounce saat unmount untuk mencegah leak.
  - Ditambahkan panel rekap nilai pada atas tabel:
    - `Terisi`,
    - `Rata-rata`,
    - `Nilai Min`,
    - `Nilai Max`.
- Catatan:
  - validasi nilai `0-100` tetap konsisten dengan flow simpan manual/massal.
- Validasi pasca implementasi:
  - `npm test` lulus.

## 41) Sprint 30 - Toggle Auto-Save Nilai Harian (Implemented)
- Menambahkan kontrol manual untuk menyalakan/mematikan auto-save dari UI.
- Perubahan:
  - `src/features/mapel/pages/MapelScorePage.jsx`:
    - state `autosaveEnabled` + tombol toggle `Auto-save: ON/OFF` di header aksi,
    - saat mode OFF: scheduler auto-save tidak berjalan,
    - timer debounce yang sedang pending dibersihkan saat toggle ke OFF agar tidak ada save tak terduga.
  - Ditambahkan info status auto-save aktif/nonaktif pada area atas tabel nilai.
- Validasi pasca implementasi:
  - `npm test` lulus.

## 42) Sprint 31 - Persistensi Toggle Auto-Save per User (Implemented)
- Menambahkan persistensi preferensi auto-save agar konsisten antar reload.
- Perubahan:
  - `src/features/mapel/pages/MapelScorePage.jsx`:
    - menerima prop `user` untuk membentuk storage key per-user,
    - key localStorage: `mapel_score_autosave:<userId>`,
    - hydrate awal dari localStorage saat halaman dibuka,
    - sinkronisasi perubahan toggle ON/OFF ke localStorage setelah state ter-hydrate.
- Dampak:
  - pilihan auto-save tiap user tersimpan mandiri (tidak saling menimpa antar akun).
- Validasi pasca implementasi:
  - `npm test` lulus.

## 43) Sprint 32 - Guru Mapel UX Pack (Implemented)
- Menuntaskan paket UI/UX prioritas untuk workspace guru mapel.
- Cakupan:
  - **(1) Flow Guru Tidak Masuk + Tugas Pengganti**
    - `src/features/mapel/pages/MapelSessionPage.jsx`:
      - section baru untuk menandai sesi `tidak masuk`,
      - input instruksi tugas pengganti + upload lampiran opsional,
      - simpan ke `teacher_absence_task` via `createTeacherAbsenceTask`.
  - **(2) Monitor Sesi Lintas Tanggal**
    - halaman baru `src/features/mapel/pages/MapelSessionHistoryPage.jsx`,
    - route baru `/mapel/riwayat`,
    - menu sidebar `Riwayat Sesi`,
    - detail sesi menampilkan agenda, ringkas absensi H/S/I/A, dan data tugas pengganti jika ada.
    - `src/services/mapelService.js` ditambah `fetchSessionsByDateRange(...)`.
  - **(3) Draft local/offline sederhana**
    - `MapelSessionPage`: draft absensi manual dipersist ke localStorage per `user+session`.
    - `MapelScorePage`: draft nilai harian dipersist ke localStorage per `user+session`.
  - **(4) Polish dashboard mapel**
    - `MapelHomePage`: quick action `Riwayat Sesi` + widget KPI harian (jadwal, sesi tercatat, hadir, tidak masuk).
- Validasi pasca implementasi:
  - `npm test` lulus.

## 44) Sprint 33 - Dark Mode Ghost Cleanup (Mapel) (Implemented)
- Menindaklanjuti temuan visual "ghost" pada modul guru mapel.
- Perbaikan dilakukan secara global di `src/index.css` agar konsisten lintas halaman mapel:
  - override background pastel di dark mode (`bg-blue-50`, `bg-amber-50`, `bg-rose-50`, `bg-green-50`) menjadi tone gelap transparan.
  - override text tone kontras untuk kelas utilitas (`text-blue-700/600`, `text-rose-700`, `text-amber-700`, `text-green-600`).
  - tambah override border untuk kelas utilitas pastel (`border-rose-200`, `border-rose-100`, `border-amber-100`).
- Dampak:
  - elemen card/info/status di halaman mapel tidak lagi terlihat "ghost" pada dark mode.
- Validasi pasca implementasi:
  - `npm test` lulus.

## 45) Sprint 34 - Backlog Closure: EWS + Delivery + Performance + Offline Sync (Implemented)
- Menuntaskan backlog tersisa V2 secara end-to-end dengan tetap menjaga batasan Supabase free-tier (query terfilter, batching ringan, tanpa polling agresif).
- Cakupan implementasi:
  - **EWS Guru Kosong SLA 15 Menit (Piket)**
    - service baru di `src/services/mapelService.js`: `fetchGuruKosongEws(...)`.
    - status EWS mencakup: `warning`, `checked_in`, `absent`, `on_window`, dengan urutan prioritas urgensi.
    - dashboard piket menampilkan ringkasan + daftar detail kelas/mapel/guru yang melewati SLA.
  - **Distribusi Tugas Pengganti oleh Piket**
    - service baru: `fetchTeacherAbsenceTasksForPicket(...)`.
    - alur update delivery aktif via `markTeacherAbsenceTaskDelivered(...)` dari dashboard piket.
    - UI menampilkan daftar pending/delivered, lampiran tugas, timestamp distribusi.
    - migration ditambah: `supabase/migrations/update_teacher_absence_task_picket_policy.sql` untuk membuka write policy role piket pada tabel `teacher_absence_task`.
  - **Teacher Performance Dashboard (Executive)**
    - service baru: `fetchMapelTeacherPerformance(...)`.
    - `ExecutiveDashboardPage` kini menampilkan panel performa guru mapel (total sesi, total guru, average presence rate, average late rate, tabel guru) dengan preset rentang 7/14/30 hari.
  - **Offline Sync Hardening + Idempotency**
    - service queue baru: `src/services/mapelSyncQueueService.js`.
    - idempotency key per record:
      - `attendance:<sessionId>:<siswaId>`
      - `score:<sessionId>:<siswaId>`
    - save absensi mapel dan nilai harian kini punya fallback offline (queue lokal) di:
      - `MapelSessionPage`
      - `MapelScorePage`
    - auto flush saat event `online` + tombol manual `Sinkron Offline`.
    - conflict handling diterapkan dengan rule konsisten **local-last-write** + notifikasi jumlah konflik terselesaikan.
- Validasi pasca implementasi:
  - `npm test` lulus (`npm run lint && npm run build`).
  - catatan environment tetap sama: warning minor Node (`22.10.0` vs rekomendasi `22.12+`), namun build sukses.

## 46) Sprint 35 - Gap Audit Logic/UI + Dark Mode + Data Sync (Implemented)
- Dilakukan audit menyeluruh terhadap gap antara logika service, UI/UX, dan konsistensi data DB pada modul apel/mapel (plus monitoring terkait tanggal).
- Perbaikan sinkronisasi tanggal (WIB) agar query/read-write data harian konsisten dan tidak offset timezone:
  - `src/services/shared/dateService.js` ditingkatkan dengan helper:
    - `formatDateToWIB(...)`
    - `getDateDaysAgoWIB(...)`
  - Halaman yang diselaraskan ke helper WIB:
    - `HalamanAbsenPage` (read + write tanggal absensi),
    - `MapelHomePage`,
    - `MapelSessionPage`,
    - `MapelScorePage`,
    - `MapelSessionHistoryPage`,
    - `MapelAuditTrailPage` (preset tanggal),
    - `RekapPiketPage`,
    - `PublicMonitoringPage` (awal bulan).
  - Service terkait tanggal log:
    - `src/services/piketService.js` (`tanggal_log` kini dihitung dalam WIB).
- Perbaikan data mapping status agar UI tetap sinkron meskipun data lama/baru bercampur:
  - `MapelSessionPage` dan `MapelSessionHistoryPage` kini mendukung normalisasi status absensi baik format label (`Hadir/Sakit/Izin/Alpha`) maupun kode (`H/S/I/A`).
  - Ringkasan status "Tidak Masuk" kini robust terhadap variasi nilai (`Tidak Masuk`, `tidak_masuk`, `absent`) di `MapelHomePage` dan `MapelSessionHistoryPage`.
- Perbaikan dark mode ghost (apel/mapel-centric) pada `src/index.css`:
  - tambahan override surface untuk `bg-gray-100`, `bg-indigo-50`, `bg-orange-50`, `bg-red-50`, `bg-yellow-50`,
  - tambahan override text untuk `text-indigo-700`, `text-red-600/700`, `text-orange-500/600`,
  - tambahan border override `border-red-*`, `border-orange-*`,
  - tambahan hover override `hover:bg-gray-100` di dark mode.
- Perbaikan kontrak audit log agar lebih sesuai domain:
  - action baru `task_delivered_by_picket` ditambahkan pada `MAPEL_AUDIT_ACTION`.
  - `markTeacherAbsenceTaskDelivered(...)` kini mencatat event tersebut secara eksplisit.
  - `MapelAuditTrailPage` ditambah filter + ringkasan metrik untuk event delivery.
  - migration DB ditambahkan:
    - `supabase/migrations/update_mapel_audit_log_actions.sql` (extend check constraint action),
    - `supabase/migrations/update_mapel_audit_log_insert_policy_for_picket.sql` (izin insert audit untuk role piket),
    - plus update kompatibilitas di migration existing:
      - `create_mapel_audit_log_table.sql`
      - `create_mapel_rls_policies.sql`.
- Validasi pasca audit:
  - `npm test` lulus (`npm run lint && npm run build`).
  - warning minor Node environment tetap sama (`22.10.0` vs rekomendasi `22.12+`), namun build sukses.

## 47) Sprint 36 - Delivery Flow Hardening for Audit Constraint Drift (Implemented)
- Menutup gap fungsi pada alur `Tandai Delivered` di dashboard piket ketika skema DB audit belum sepenuhnya selaras.
- Problem:
  - Pada sebagian skema live, constraint `mapel_audit_log_action_type_check` belum memuat action `task_delivered_by_picket`.
  - Dampaknya, update delivery tugas pengganti bisa sudah berhasil tetapi proses insert audit gagal dan terbaca sebagai kegagalan total di UI.
- Perbaikan:
  - `src/services/mapelService.js`:
    - `markTeacherAbsenceTaskDelivered(...)` kini melakukan hardening:
      - update `teacher_absence_task` tetap dieksekusi sebagai operasi utama,
      - insert audit untuk `task_delivered_by_picket` dibungkus handling khusus constraint mismatch (`postgres code 23514` + nama constraint),
      - jika mismatch terdeteksi, fungsi mengembalikan `audit_warning` alih-alih melempar error total.
  - `src/features/piket/pages/PiketDashboardPage.jsx`:
    - UI membaca `audit_warning` dan menampilkan notifikasi `Berhasil (dengan catatan)` agar operator tahu delivery sudah sukses, namun migrasi audit action masih perlu diterapkan.
- Dampak:
  - Operasional piket tidak terblokir oleh drift skema audit.
  - Error handling menjadi lebih jujur: update delivery sukses, tapi debt migrasi tetap terlihat eksplisit.
- Validasi pasca implementasi:
  - `npm test` lulus (`npm run lint && npm run build`).
  - warning minor Node environment tetap sama (`22.10.0` vs rekomendasi `22.12+`), namun build sukses.

## 59) Sprint 48 - Hapus Kelas Cascade Siswa, Wali Kelas Tetap Aman (Implemented)
- Menindaklanjuti isu bahwa hapus `master_kelas` belum membersihkan data turunan sehingga data siswa masih tersisa dan perlu dihapus manual.
- Perbaikan:
  - menambahkan migration `supabase/migrations/update_master_kelas_delete_cascade_behavior.sql` untuk memperbarui foreign key menjadi:
    - `master_kelas -> siswa` = `ON DELETE CASCADE`,
    - `master_kelas -> schedule` = `ON DELETE CASCADE`,
    - `master_kelas -> walikelas(kelas_id)` = `ON DELETE SET NULL` (akun wali kelas tidak ikut terhapus),
    - rantai turunan siswa (`absensi`, `log_piket`, `student_attendance_mapel`, `daily_score`) = `ON DELETE CASCADE`,
    - rantai turunan session/schedule (`session`, `class_agenda`, `teacher_absence_task`, `student_attendance_mapel`, `daily_score`) = `ON DELETE CASCADE`.
  - memperbarui dokumentasi `skema.md` agar perilaku FK sesuai kondisi terbaru.
- Dampak:
  - hapus kelas kini membersihkan data siswa beserta data turunannya secara otomatis.
  - data akun guru/wali kelas tetap aman; hanya relasi `kelas_id` yang menjadi `NULL` saat kelas dihapus.
- Validasi pasca implementasi:
  - `npm test` lulus (`npm run lint && npm run build`).
  - warning minor Node environment tetap sama (`22.10.0` vs rekomendasi `22.12+`), namun build sukses.

## 48) Sprint 37 - Executive Control Data Recovery (Implemented)
- Menangani isu `Executive Control` yang tampil kosong (khususnya blok rekap absensi) pada kondisi tertentu.
- Akar masalah:
  - Sesi login tidak menyimpan `jurusan_id`, sehingga filter kaprog (`jurusan_id`) bisa bernilai tidak valid dan membuat query kelas mengembalikan kosong.
  - Beberapa query dashboard belum mem-propagate error, sehingga kegagalan query terlihat seperti "tidak ada data".
- Perbaikan:
  - `src/services/auth/sessionService.js`
    - payload sesi kini menyimpan `jurusan_id` agar context role kaprog tetap utuh lintas reload.
  - `src/features/dashboard/pages/ExecutiveDashboardPage.jsx`
    - hardening resolver jurusan untuk kaprog:
      - jika `user.jurusan_id` tidak valid, fallback ambil `jurusan_id` dari tabel `walikelas` berdasarkan ID session.
    - validasi error query pada tahap data inti (`master_kelas`, `siswa`, `walikelas`) agar gagal terdeteksi jelas.
    - tambah alert error terarah (`Swal`) saat load executive data gagal.
- Dampak:
  - Data monitoring/rekap absensi kembali muncul untuk akun executive (terutama kaprog) ketika data jurusan tersedia.
  - Failure mode tidak lagi silent.
- Validasi pasca implementasi:
  - `npm test` lulus (`npm run lint && npm run build`).
  - warning minor Node environment tetap sama (`22.10.0` vs rekomendasi `22.12+`), namun build sukses.

## 49) Sprint 38 - Audit Trail Readability Upgrade (Implemented)
- Meningkatkan keterbacaan halaman `Audit Trail Mapel` agar lebih mudah dipahami user non-teknis.
- Problem:
  - Data audit sebelumnya menampilkan role mentah (`kaprog`, `kesiswaan`, dst) dan metadata JSON mentah, sehingga membingungkan untuk pembaca operasional.
- Perbaikan:
  - `src/features/mapel/pages/MapelAuditTrailPage.jsx`:
    - label aksi diperjelas (`Simpan Absensi Siswa (Manual)`),
    - role actor di-humanize (contoh: `Kaprog (akses mapel)`, `Guru Piket`, `Guru Mapel`),
    - status sesi di-humanize (`Tidak Masuk`, `Checked-In`, dll),
    - metadata tiap aksi diterjemahkan ke ringkasan human-readable:
      - agenda: topik & metode,
      - check-in/out: waktu + status bukti foto,
      - absensi manual: sumber input, total entri, rekap status,
      - delivery piket: status distribusi + waktu + task ID.
    - JSON teknis tetap tersedia via panel `Lihat data teknis (JSON)` agar kebutuhan audit detail tetap terjaga.
    - opsi actor filter dan export kini memakai label role yang sudah human-readable.
- Dampak:
  - Tim operasional/kurikulum lebih cepat memahami konteks log tanpa perlu membaca JSON mentah.
- Validasi pasca implementasi:
  - `npm test` lulus (`npm run lint && npm run build`).
  - warning minor Node environment tetap sama (`22.10.0` vs rekomendasi `22.12+`), namun build sukses.

## 50) Sprint 39 - Audit Trail Session-Centric UX (Implemented)
- Menyesuaikan `Audit Trail Mapel` agar benar-benar fokus ke kebutuhan user operasional, bukan log teknis actor/action.
- Problem:
  - User membutuhkan ringkasan sesi yang langsung menjawab pertanyaan inti:
    - guru siapa, mapel apa, kelas mana, jam mengajar,
    - check-in/check-out kapan + bukti fotonya,
    - jumlah siswa Hadir/Sakit/Izin/Alpha,
    - agenda/topik pembelajaran,
    - jika tidak masuk: alasan/instruksi + lampiran tugas pengganti.
- Perbaikan:
  - `src/services/mapelService.js`:
    - tambah fungsi baru `fetchMapelAuditSessionSummary(...)` yang menggabungkan data lintas tabel (`session`, `schedule`, `walikelas`, `class_agenda`, `student_attendance_mapel`, `teacher_absence_task`) menjadi ringkasan per sesi.
  - `src/features/mapel/pages/MapelAuditTrailPage.jsx`:
    - dirombak menjadi tampilan **session-centric cards**:
      - identitas sesi: guru, mapel, kelas, hari & jam,
      - status sesi (Hadir/Pending/Tidak Masuk),
      - waktu check-in/out + link bukti foto,
      - agenda (topik + metode),
      - rekap absensi siswa H/S/I/A,
      - panel khusus untuk kasus `Tidak Masuk` (alasan/instruksi + lampiran).
    - filter disederhanakan ke rentang tanggal + kelas + mapel.
    - export Excel mengikuti format ringkasan sesi yang sama (tanpa actor ID mentah).
- Dampak:
  - Audit kini lebih informatif dan langsung bisa dipakai kurikulum/management tanpa interpretasi JSON teknis.
  - Konsistensi tampilan antara layar dan export meningkat.
- Validasi pasca implementasi:
  - `npm test` lulus (`npm run lint && npm run build`).
  - warning minor Node environment tetap sama (`22.10.0` vs rekomendasi `22.12+`), namun build sukses.

## 51) Sprint 40 - Quick Filter Per Kelas (Implemented)
- Menambahkan filter per kelas yang lebih eksplisit di halaman `Audit Trail Mapel`.
- Perbaikan:
  - `src/features/mapel/pages/MapelAuditTrailPage.jsx`:
    - tetap mempertahankan dropdown kelas,
    - menambah **Filter Kelas Cepat** berupa tombol per kelas + tombol `Semua Kelas`,
    - menampilkan konteks kelas aktif pada info total data (`Total sesi (Nama Kelas)`).
- Dampak:
  - User bisa berpindah audit antar kelas lebih cepat tanpa membuka dropdown berulang.
  - Filter kelas menjadi lebih terlihat dan mudah dipahami secara visual.
- Validasi pasca implementasi:
  - `npm test` lulus (`npm run lint && npm run build`).
  - warning minor Node environment tetap sama (`22.10.0` vs rekomendasi `22.12+`), namun build sukses.

## 52) Sprint 41 - Quick Filter Kelas Rollback (Implemented)
- Menindaklanjuti feedback user: section `Filter Kelas Cepat` dianggap tidak perlu karena sudah ada dropdown kelas.
- Perbaikan:
  - `src/features/mapel/pages/MapelAuditTrailPage.jsx`:
    - menghapus blok tombol `Filter Kelas Cepat`,
    - menghapus state turunan label kelas cepat yang tidak lagi dipakai,
    - ringkasan total dikembalikan ke format netral: `Total sesi sesuai filter`.
- Dampak:
  - UI lebih ringkas dan fokus ke satu mekanisme filter kelas (dropdown).
- Validasi pasca implementasi:
  - `npm test` lulus (`npm run lint && npm run build`).
  - warning minor Node environment tetap sama (`22.10.0` vs rekomendasi `22.12+`), namun build sukses.

## 53) Sprint 42 - Sidebar Workspace Separation for Wali Kelas + Guru Mapel (Implemented)
- Menangani isu menu walikelas yang tercampur di workspace mapel untuk user multi-role (`walikelas` sekaligus `guru mapel`).
- Perbaikan:
  - `src/app/AppShell.jsx`:
    - menu walikelas `Operasional` (`Input Absensi`) dan `Laporan` (`Log Absensi`, `Akumulasi`) kini hanya dirender saat **bukan** `isMapelWorkspace`.
    - saat berada di route `/mapel/*`, sidebar fokus ke menu mapel saja.
- Dampak:
  - Workspace mapel tidak lagi tercampur dengan menu apel walikelas.
  - Menu walikelas tetap tersedia normal di dashboard/modul apel.
- Validasi pasca implementasi:
  - `npm test` lulus (`npm run lint && npm run build`).
  - warning minor Node environment tetap sama (`22.10.0` vs rekomendasi `22.12+`), namun build sukses.

## 54) Sprint 43 - Post-Login Workspace Redirect Normalization (Implemented)
- Menangani isu multi-role `walikelas + guru mapel` yang setelah login langsung masuk dashboard, bukan ke portal pemilihan workspace.
- Perbaikan:
  - `src/App.jsx`:
    - pada `handleLoginSuccess`, path browser dinormalisasi ke `/` sebelum state login diaktifkan.
    - dengan ini, redirect resmi app dari route root berjalan konsisten:
      - user multi-workspace -> `Portal Workspace`,
      - user single-workspace -> dashboard default sesuai rolenya.
- Dampak:
  - Alur login untuk user multi-role kembali sesuai desain: wajib pilih workspace dulu.
  - Mencegah kondisi ikut path lama (`/dashboard`) yang membuat portal terlewat.
- Validasi pasca implementasi:
  - `npm test` lulus (`npm run lint && npm run build`).
  - warning minor Node environment tetap sama (`22.10.0` vs rekomendasi `22.12+`), namun build sukses.

## 55) Sprint 44 - Teacher Performance Dipisah dari Executive Control (Implemented)
- Menindaklanjuti arahan agar `Teacher Performance` tidak lagi bercampur di menu/halaman `Executive Control`.
- Perbaikan:
  - `src/features/dashboard/pages/TeacherPerformancePage.jsx` (baru):
    - halaman khusus teacher performance dengan filter kelas + rentang 7/14/30 hari,
    - menampilkan metrik inti (`total sesi`, `total guru`, `average presence`, `average late`) dan tabel performa guru.
  - `src/routes/AppRoutes.jsx`:
    - menambahkan route baru `TEACHER_PERFORMANCE_ROUTE` dengan guard executive role.
  - `src/shared/constants/routes.js`:
    - menambahkan konstanta route `/teacher-performance`.
  - `src/app/AppShell.jsx`:
    - menambahkan menu sidebar baru `Teacher Performance` (hanya di workspace non-mapel untuk executive).
  - `src/features/dashboard/pages/ExecutiveDashboardPage.jsx`:
    - menghapus blok Teacher Performance (state, query, dan UI) agar `Executive Control` fokus kembali ke data siswa/absensi.
- Dampak:
  - Struktur menu lebih jelas: `Executive Control` untuk monitoring siswa/kelas, `Teacher Performance` untuk performa guru mapel.
  - Mengurangi kebingungan user karena konteks data tidak tercampur.
- Validasi pasca implementasi:
  - `npm test` lulus (`npm run lint && npm run build`).
  - warning minor Node environment tetap sama (`22.10.0` vs rekomendasi `22.12+`), namun build sukses.

## 56) Sprint 45 - Role Menu, Login UX, dan Teacher Performance Enrichment (Implemented)
- Menindaklanjuti beberapa arahan lanjutan pada workspace manajemen absen, login, dan metrik performa guru.
- Perbaikan:
  - Role menu manajemen absen:
    - `kesiswaan` sekarang hanya menampilkan `Executive Control`.
    - `kurikulum` tidak lagi menampilkan `Executive Control`, dan hanya menampilkan `Teacher Performance` + `Audit Trail Mapel`.
    - default route role `kurikulum` diarahkan ke `Teacher Performance` agar selaras dengan menu yang tersedia.
  - Login UX:
    - `src/features/auth/pages/LoginPage.jsx`: menambahkan tombol ikon mata untuk show/hide password.
    - `src/shared/ui/InputField.jsx`: menambahkan dukungan `endAdornment` agar bisa dipakai untuk toggle password dan kebutuhan input serupa.
  - Teacher Performance:
    - `src/services/mapelService.js`:
      - menambahkan agregasi `check_in_sessions` dan `check_out_sessions` per guru,
      - menambahkan summary `totalCheckIns` dan `totalCheckOuts`,
      - menambahkan `check_out_rate` per guru dengan rumus `check_out_sessions / check_in_sessions` (jika `check_in_sessions = 0`, nilai `null`).
      - memperjelas aturan keterlambatan dengan toleransi khusus `15 menit` (`LATE_CHECKIN_TOLERANCE_MINUTES = 15`) untuk perhitungan `late_ratio`.
    - `src/features/dashboard/pages/TeacherPerformancePage.jsx`:
      - menampilkan card summary `Total Check-in` dan `Total Check-out`,
      - menambahkan kolom tabel `Check-in`, `Check-out`, dan `Check-out Rate`,
      - menampilkan `-` jika `check_out_rate` tidak dapat dihitung (karena check-in = 0),
      - subtitle diperbarui agar toleransi `15 menit` terlihat jelas.
- Dampak:
  - Navigasi role executive menjadi lebih presisi sesuai kebutuhan operasional.
  - UX login lebih ramah pengguna saat input password.
  - Dashboard `Teacher Performance` menjadi lebih lengkap untuk memantau disiplin check-in/check-out dan konsistensi penutupan sesi.
- Validasi pasca implementasi:
  - `npm test` lulus (`npm run lint && npm run build`).
  - warning minor Node environment tetap sama (`22.10.0` vs rekomendasi `22.12+`), namun build sukses.

## 57) Sprint 46 - User & Akses: Template, Export, dan Import Usability (Implemented)
- Menindaklanjuti arahan admin agar pengisian akun lebih mudah di menu `User & Akses`.
- Perbaikan:
  - `src/features/admin/pages/ManajemenUserPage.jsx`:
    - menambahkan tombol `Template` untuk mengunduh format baku import akun (`template_import_user_akses.xlsx`),
    - menambahkan tombol `Export` untuk mengunduh data akun saat ini (`data_user_akses_YYYY-MM-DD.xlsx`),
    - mempertahankan tombol `Import Excel` agar alur tetap familiar.
  - Penyempurnaan parser import akun:
    - mendukung alias header umum: `nama`/`nama_lengkap`, `akses`/`role`, `kelas_diampu`/`kelas`, `guru_mapel`/`is_guru_mapel`, dan varian username,
    - validasi wajib untuk `username`, `nama_lengkap`, role valid, serta kelas khusus role walikelas,
    - normalisasi nilai (username lowercase tanpa spasi, nama uppercase, default password `Jingga123`),
    - deduplikasi username dalam 1 file import (baris terakhir digunakan) dengan ringkasan hasil proses.
- Dampak:
  - Proses onboarding akun dari Excel menjadi lebih cepat dan minim kesalahan format.
  - Admin mendapat alur lengkap: download template -> isi data -> import -> export verifikasi.
- Validasi pasca implementasi:
  - `npm test` lulus (`npm run lint && npm run build`).
  - warning minor Node environment tetap sama (`22.10.0` vs rekomendasi `22.12+`), namun build sukses.

## 58) Sprint 47 - Manajemen Siswa Dark Mode Ghost Cleanup (Implemented)
- Menindaklanjuti feedback UI dark mode pada menu `Manajemen Siswa`, khususnya area `Aksi Massal`.
- Perbaikan:
  - `src/features/admin/pages/ManajemenSiswaPage.jsx`:
    - tombol `Aksi Massal` disesuaikan menjadi tampilan solid di dark mode (`bg-slate-700`, border kontras, hover solid),
    - tombol `Manual` disamakan stylenya agar konsisten dengan tombol `Aksi Massal`,
    - popup SweetAlert pada alur `Aksi Massal` (`Aksi Massal Kelas` dan `Pilih Kelas Tujuan`) diberi dark theme options:
      - background + text kontras,
      - backdrop lebih gelap,
      - input select bergaya gelap saat popup dibuka.
- Dampak:
  - Menghilangkan efek “ghost” pada tombol dan popup aksi massal di dark mode.
  - Konsistensi visual action controls pada header Manajemen Siswa meningkat.
- Validasi pasca implementasi:
  - `npm test` lulus (`npm run lint && npm run build`).
  - warning minor Node environment tetap sama (`22.10.0` vs rekomendasi `22.12+`), namun build sukses.

## 59) Sprint 48 - KBM Sesi Hari Ini Strict Filter + Empty State Guru (Implemented)
- Menindaklanjuti isu di workspace KBM (menu Sesi & Absensi) di mana dropdown jadwal masih menampilkan jadwal lintas hari.
- Perbaikan:
  - `src/services/mapelService.js`:
    - menambahkan `fetchSchedulesByGuruToday(guruId, tanggal)` untuk mengambil jadwal guru berdasarkan hari berjalan (WIB),
    - menambahkan guard di `createSession` agar sesi hanya bisa dibuat jika `hari` jadwal sesuai hari dari tanggal sesi (WIB), sehingga jadwal hari lain ditolak walau ada bypass UI.
  - `src/features/mapel/pages/MapelSessionPage.jsx`:
    - sumber dropdown jadwal diubah menjadi jadwal hari ini saja,
    - menambahkan sinkronisasi `selectedScheduleId` agar otomatis reset jika jadwal terpilih tidak valid,
    - menerapkan **hard empty-state**: jika guru tidak punya jadwal hari ini, halaman hanya menampilkan pesan
      `Anda tidak punya jadwal hari ini, silahkan ambil aktifitas untuk meningkatkan pelayanan terhadap siswa.`
      dan seluruh form/tombol sesi-absensi tidak dirender.
  - `src/features/mapel/pages/MapelHomePage.jsx`:
    - ringkasan `Jadwal Hari Ini` kini menghitung dari jadwal yang sudah terfilter hari ini.
- Dampak:
  - Guru tidak bisa lagi membuka/memproses sesi dari jadwal hari lain.
  - UX lebih jelas untuk guru yang memang tidak memiliki jadwal pada hari berjalan.
- Validasi pasca implementasi:
  - `npm run lint && npm run build` lulus.
  - warning minor Node environment tetap sama (`22.10.0` vs rekomendasi `22.12+`), namun build sukses.

## 60) Sprint 49 - Jadwal Mengajar: Tambah Opsi Hari Minggu untuk Pengujian (Implemented)
- Menindaklanjuti kebutuhan testing operasional di hari Minggu.
- Perbaikan:
  - `src/features/mapel/components/ScheduleForm.jsx`:
    - menambahkan opsi `Minggu` pada `DAY_OPTIONS` dropdown hari jadwal mengajar.
- Dampak:
  - Admin/guru mapel bisa membuat jadwal khusus hari Minggu untuk kebutuhan uji coba alur sesi/absensi.
- Validasi pasca implementasi:
  - `npm run lint && npm run build` lulus.
  - warning minor Node environment tetap sama (`22.10.0` vs rekomendasi `22.12+`), namun build sukses.

## 61) Sprint 50 - Teacher Absence Task Schema Fix + Piket Alert Simplification (Implemented)
- Menindaklanjuti error schema saat simpan tugas pengganti dan feedback UX notifikasi distribusi tugas yang terlalu teknis.
- Perbaikan:
  - `src/services/mapelService.js`:
    - memperbaiki `createTeacherAbsenceTask` dengan menghapus kolom `teacher_id` dari payload insert karena kolom tersebut tidak ada pada schema `teacher_absence_task` (mengacu `skema.md`).
  - `src/features/piket/pages/PiketDashboardPage.jsx`:
    - menyederhanakan alert setelah aksi delivery: user selalu mendapat notifikasi sukses standar,
    - warning audit teknis (`audit_warning`) tidak ditampilkan ke user, namun tetap dicatat di `console.warn` untuk observabilitas internal.
- Dampak:
  - Simpan tugas pengganti guru kembali normal tanpa error schema cache.
  - User piket/guru tidak lagi melihat pesan teknis migrasi DB yang membingungkan.
- Validasi pasca implementasi:
  - `npm run lint && npm run build` lulus.
  - warning minor Node environment tetap sama (`22.10.0` vs rekomendasi `22.12+`), namun build sukses.

## 62) Sprint 51 - PWA Install UX Recovery (Implemented)
- Menindaklanjuti issue tombol install aplikasi (PWA) yang tidak muncul di sidebar (area atas tombol logout / di atas kartu user).
- Perbaikan:
  - `src/main.jsx`:
    - menambahkan registrasi service worker di mode production (`navigator.serviceWorker.register('/service-worker.js')`).
  - `public/service-worker.js` (baru):
    - menambahkan service worker minimal untuk memenuhi syarat dasar installability (`install` + `activate` + `clients.claim`).
  - `src/app/hooks/usePwaInstallPrompt.js`:
    - menambah deteksi platform iOS dan mode standalone,
    - mempertahankan alur `beforeinstallprompt` untuk browser yang mendukung prompt install native.
  - `src/App.jsx` + `src/app/AppShell.jsx`:
    - menyalurkan state PWA (`isIos`, `isStandalone`) ke shell,
    - menampilkan area install lebih konsisten:
      - jika prompt native tersedia: tombol `Install Aplikasi` aktif,
      - jika iOS non-standalone: menampilkan instruksi manual `Add to Home Screen`.
- Dampak:
  - Opsi install aplikasi kembali terlihat dan tidak sepenuhnya bergantung pada event browser tertentu.
  - User iOS tetap mendapat jalur install manual yang jelas meski tidak ada `beforeinstallprompt`.
- Validasi pasca implementasi:
  - `npm run lint && npm run build` lulus.
  - warning minor Node environment tetap sama (`22.10.0` vs rekomendasi `22.12+`), namun build sukses.

## 63) Sprint 52 - Mapel Dashboard Density Reduction + Informative KPI (Implemented)
- Menindaklanjuti feedback user bahwa dashboard workspace KBM terasa kurang informatif dan terlalu padat.
- Perbaikan di `src/features/mapel/pages/MapelHomePage.jsx`:
  - Dashboard dipecah jadi 3 lapis informasi agar hierarki lebih jelas:
    - **Hero ringkas** (sapaan user, tanggal WIB, CTA utama `Mulai / Lanjutkan Sesi Hari Ini`, dan progress penutupan sesi),
    - **KPI operasional cepat** (Jadwal Hari Ini, Belum Dimulai, Sesi Aktif, Sesi Selesai),
    - **Prioritas Aksi** berbentuk kartu (Sesi & Absensi, Nilai Harian, Riwayat Sesi) + aksi sekunder (Kelola Jadwal, Audit Trail).
  - Menambah agregasi KPI harian untuk kebutuhan keputusan cepat guru:
    - `checkIn`, `checkOut`, `pendingMulai`, `sesiAktif`,
    - progress completion harian (`checkOut / jadwal`) dalam bentuk bar visual.
  - Ringkasan status tetap dipertahankan (`Hadir`, `Tidak Masuk`) agar konteks kehadiran tetap terlihat tanpa menambah kepadatan tabel.
- Dampak:
  - Dashboard lebih fokus ke **aksi prioritas harian** dibanding sekadar daftar tombol.
  - Kepadatan visual berkurang, keterbacaan mobile lebih baik, dan user bisa membaca status hari ini dalam sekali lihat.
- Validasi pasca implementasi:
  - `npm test` lulus (`npm run lint && npm run build`).
  - warning minor Node environment tetap sama (`22.10.0` vs rekomendasi `22.12+`), namun build sukses.

## 64) Sprint 53 - Sesi & Absensi Step-Based Mobile UX (Implemented)
- Menindaklanjuti feedback user bahwa halaman `Sesi & Absensi` terasa padat dan melelahkan, terutama di perangkat HP.
- Perbaikan di `src/features/mapel/pages/MapelSessionPage.jsx`:
  - Alur operasional dipecah menjadi struktur langkah bertahap yang lebih jelas:
    - **Langkah 1** pilih jadwal,
    - **Langkah 2** submit agenda,
    - **Langkah 3** isi absensi,
    - **Langkah 4** check-out.
  - Ditambahkan panel **Progress Langkah KBM** (4 status card) agar user langsung tahu posisi proses.
  - Operasional sesi dipisahkan ke card khusus:
    - aksi check-in/check-out,
    - QR scanner tetap opsional,
    - informasi kompresi foto tetap tersedia.
  - Card absensi manual dipertahankan sebagai flow utama, namun diposisikan jelas sebagai **Langkah 3 · Absensi Manual (Utama)**.
  - Area risiko tinggi (`Mode Guru Tidak Masuk + Tugas Pengganti`) dipindahkan ke blok `details/summary` terlipat agar tidak mengganggu flow rutin harian.
- Dampak:
  - Kepadatan visual berkurang signifikan di mobile.
  - User mendapat panduan flow yang lebih tegas dari awal sampai penutupan sesi.
  - Aksi non-rutin tidak lagi “berebut perhatian” dengan aksi inti absensi.
- Validasi pasca implementasi:
  - `npm test` lulus (`npm run lint && npm run build`).
  - warning minor Node environment tetap sama (`22.10.0` vs rekomendasi `22.12+`), namun build sukses.

## 65) Sprint 54 - Adaptive Compression Ladder for Check-in/Check-out (Implemented)
- Menindaklanjuti kendala operasional pada beberapa perangkat HP di mana check-in/check-out gagal saat kompresi dipaksa ke 10KB.
- Constraint tetap dipertahankan: Supabase free-tier membutuhkan disiplin ukuran file agar storage aman.
- Design keputusan (disepakati):
  - strategi **capture-first UX** (guru ambil foto dulu, sistem mengolah otomatis),
  - **adaptive ladder normal**: `10KB -> 15KB -> 20KB -> 25KB -> 30KB`,
  - **emergency ladder** jika normal gagal: `40KB -> 50KB`,
  - simpan flag `oversize_emergency` untuk kasus >30KB s.d 50KB.
- Tujuan:
  - menghapus kegagalan check-in/check-out akibat hard limit 10KB,
  - menjaga mayoritas upload tetap <=30KB,
  - tetap menjaga keterbacaan konteks foto ruang kelas.
- Implementasi yang diselesaikan:
  - `src/shared/utils/compressionPolicy.js` (baru): policy ladder ukuran (`10,15,20,25,30,40,50`), resolver mode (`normal/emergency/failed`), dan helper retry upload `retryAsync`.
  - `src/shared/utils/compressionPolicy.test.mjs` (baru): unit test policy + retry (8 skenario lulus).
  - `src/shared/utils/compressor.js`: menambahkan `compressImageAdaptiveForSession(...)` berbasis adaptive ladder untuk flow sesi KBM.
  - `src/features/mapel/pages/MapelSessionPage.jsx`: flow check-in/check-out memakai kompresi adaptif + retry upload (`retries:2`, `delayMs:500`) + feedback terpisah (`optimal` vs `mode darurat`).
  - `src/services/supabase/storageService.js`: normalisasi metadata upload sesi (`compressionMode`, `oversizeEmergency`).
- Observability yang direncanakan:
  - distribusi ukuran mingguan (`<=10KB`, `11-30KB`, `31-50KB`),
  - alert jika rasio emergency melampaui ambang (initial 20%).
- Catatan dokumen desain:
  - detail desain disimpan di `docs/superpowers/specs/2026-04-02-kbm-checkin-checkout-adaptive-compression-design.md`.
- Validasi pasca implementasi:
  - `npm run test:unit` lulus (`8/8` test `compressionPolicy`).
  - `npm test` lulus (`npm run lint && npm run build`).
  - warning minor Node environment tetap sama (`22.10.0` vs rekomendasi `22.12+`), namun build sukses.

## 66) Sprint 55 - Rekapitulasi Kehadiran KBM + Excel Export (Implemented)
- Rekap KBM aktif dengan warning finalitas saat `totalBelumDiisi > 0` dan badge status `Final/Belum Final` pada hasil rekap.
- Aksi `Perbaiki Data Bolong` ditambahkan di halaman rekap untuk memilih kombinasi sesi+siswa yang belum terisi lalu submit status `H/S/I/A` via `fillMissingAttendanceForSession`.
- Service rekap kini mengembalikan daftar `missingEntries` agar UX backfill terarah (bukan input bebas) dan tetap sesuai kelas/mapel/periode aktif.
- Export Excel kini memakai **dataset aktif saat ini** (tanpa re-query) dan menambahkan baris metadata di atas tabel: `kelas`, `mapel`, `periode`, `posting date`, `finalitas`.
- Catatan dokumen desain tetap: `docs/superpowers/specs/2026-04-02-kbm-rekapitulasi-kehadiran-design.md`.
