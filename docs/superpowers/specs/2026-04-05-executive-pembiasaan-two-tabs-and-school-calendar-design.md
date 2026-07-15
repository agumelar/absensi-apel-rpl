# Executive Pembiasaan Two Tabs + School Calendar Design

## Context
- Halaman `Laporan Pembiasaan` saat ini masih 1 tabel detail campur, kurang ringkas untuk monitoring harian executive.
- Rekap per guru belum menampilkan metrik kewajiban (expected) vs realisasi (actual).
- Kebijakan baru: kewajiban absensi hanya pada hari sekolah aktif (weekday minus libur sekolah), dan auto-alpha harus skip weekend/libur.

## Goals
- Membagi halaman laporan pembiasaan menjadi 2 tab informatif:
  - Monitoring Harian
  - Rekap Guru
- Menambahkan kalkulasi `total_kewajiban` + `% kepatuhan` yang adil dan konsisten.
- Menjadikan kalender sekolah sebagai sumber kebenaran hari non-aktif.
- Menetapkan rollout bertahap: pembiasaan dulu, lalu modul absensi lain.

## Functional Design

### 1) Tab Monitoring Harian
- Menampilkan siapa yang submit hari itu, status, aktivitas, dan jam absen.
- Filter utama: rentang tanggal + aktivitas; filter tab: tanggal fokus (harian) + status (opsional).
- Jika tanggal fokus adalah hari libur sekolah, tampilkan info non-aktif.

### 2) Tab Rekap Guru
- Satu baris per guru pada periode filter.
- Kolom:
  - Nama Guru
  - Hadir / Izin / Sakit / Alpha
  - Total Aktual
  - Total Kewajiban
  - Kepatuhan (%)
- Filter aktivitas: `all`, `sapa_pagi`, `pembiasaan`.

### 3) Definisi Metrik
- `total_aktual = hadir + izin + sakit + alpha`
- `total_kewajiban`:
  - Hari aktif = Senin-Jumat dikurangi tanggal libur sekolah.
  - Jika `activity_type = pembiasaan`: kewajiban = jumlah hari aktif pada rentang.
  - Jika `activity_type = sapa_pagi`: kewajiban = jumlah hari aktif yang user terjadwal di `sapa_pagi_schedule`.
  - Jika `activity_type = all`: jumlah dua kewajiban di atas.
- `kepatuhan = (total_aktual / total_kewajiban) * 100`, default `0` saat kewajiban `0`.

### 4) Kalender Sekolah (Single Source of Truth)
- Tabel kalender sekolah untuk menandai hari libur/non-aktif.
- Admin menjadi pengelola tunggal (CRUD), executive read-only.
- Wajib audit metadata (`updated_by`, `updated_at`, `notes`).

### 5) Auto-Alpha Policy
- Skip pada:
  - weekend,
  - tanggal yang ditandai libur sekolah.
- Hanya berjalan pada hari aktif sekolah.

## Non-Functional
- Query rekap dilakukan di backend/service (bukan agregasi berat di frontend) agar stabil pada data besar.
- Export mengikuti tab aktif dan menyertakan metadata filter + jumlah hari libur yang dikecualikan.

## Rollout Strategy

### Phase 1 (Now)
- Implement 2 tab laporan pembiasaan.
- Implement rekap guru + kalkulasi kewajiban dari kalender sekolah.
- Integrasi skip libur sekolah di auto-alpha pembiasaan.

### Phase 2
- Tambah UI admin kalender sekolah + guard role.

### Phase 3
- Terapkan policy kalender sekolah ke semua logic absensi (KBM/mapel/rekap lintas modul).

## Acceptance Criteria
- Monitoring harian menampilkan data ringkas dan mudah dipakai untuk kontrol harian.
- Rekap guru menampilkan aktual + kewajiban + kepatuhan yang konsisten untuk filter yang sama.
- Weekend/libur sekolah tidak menambah alpha otomatis.
- Perubahan kalender sekolah dapat diaudit.
