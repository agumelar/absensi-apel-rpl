# KBM Rekapitulasi Kehadiran Design

## Context
- Workspace KBM sudah memiliki flow operasional sesi (check-in/out, agenda, absensi), tetapi belum memiliki menu rekap per siswa yang memudahkan guru melihat ringkasan H/S/I/A dan persentase kehadiran.
- Kebutuhan utama adalah rekap yang tidak mencampur kelas lain, karena guru bisa mengampu beberapa kelas dalam periode yang sama.
- Rekap dibutuhkan untuk konsumsi operasional guru sekaligus kebutuhan laporan (download Excel).

## Goals
- Menyediakan halaman baru `Rekapitulasi KBM` di sidebar khusus workspace KBM (role-based).
- Menyediakan rekap per siswa untuk kombinasi filter `Kelas -> Mapel -> Periode`.
- Menyediakan default periode bulanan, opsi hari ini, dan rentang tanggal custom.
- Menampilkan posting date dan indikator kelengkapan data absensi.
- Menyediakan download laporan Excel yang sesuai 1:1 dengan tabel yang sedang tampil.

## Non-Goals
- Tidak membangun materialized view/caching kompleks pada fase awal (pendekatan on-demand).
- Tidak menambah fitur lintas workspace non-KBM.
- Tidak mengubah aturan inti status absensi yang sudah berjalan di flow sesi.

## Scope & Access
- Menu baru muncul di sidebar hanya untuk role yang memiliki akses workspace KBM.
- Menu tidak ditampilkan di workspace lain.
- Semua data yang ditampilkan dibatasi oleh hak akses guru login (kelas/mapel yang diampu).

## Functional Design

### 1) Halaman Baru Rekapitulasi KBM
- Halaman memuat card filter di bagian atas, ringkasan metadata rekap, tabel siswa, dan aksi export.
- Struktur filter berurutan:
  1. Kelas
  2. Mapel
  3. Periode (Bulanan default / Hari ini / Rentang tanggal)
- Query dijalankan saat user menekan tombol `Terapkan` agar kontrol perubahan filter jelas.

### 2) Periode & Posting Date
- Default periode: Bulanan.
- Opsi periode:
  - Hari ini
  - Bulanan
  - Rentang tanggal (from-to)
- Validasi rentang tanggal: `from <= to`.
- Posting date ditampilkan sebagai timestamp update terbaru dari dataset rekap aktif.

### 3) Tabel Rekap Per Siswa
- Kolom wajib:
  - Nama siswa
  - NIS
  - Total pertemuan
  - H
  - S
  - I
  - A
  - Belum diisi
  - % Kehadiran
- Definisi total pertemuan:
  - jumlah sesi terposting untuk kombinasi kelas+mapel terpilih pada periode aktif.
  - tidak mencampur sesi dari kelas lain walau gurunya sama.
- Rumus persentase kehadiran:
  - `% Kehadiran = H / total_pertemuan * 100`.

### 4) Data Completeness & Backfill
- Jika ada sesi terposting namun siswa belum punya entri absensi, status dicatat sebagai `Belum diisi` (bukan otomatis A).
- Jika ada `Belum diisi > 0`, tampil warning bahwa data belum final.
- Sediakan aksi `Perbaiki Data Bolong` untuk mengoreksi entri absensi yang kosong pada sesi/tanggal tertentu.
- Koreksi menyimpan audit metadata (`diubah_pada`, `diubah_oleh`) untuk transparansi.

### 5) Download Excel
- Tombol `Download Excel` tersedia di halaman rekap.
- Isi Excel harus sama 1:1 dengan tabel aktif pada layar (mengikuti filter saat ini).
- Header file laporan mencantumkan:
  - kelas,
  - mapel,
  - periode,
  - posting date,
  - status finalitas data (`Final` / `Belum Final` jika masih ada `Belum diisi`).

## Data Flow (On-Demand)
1. User memilih filter dan klik `Terapkan`.
2. Sistem mengambil sesi untuk `kelas+mapel+periode`.
3. Sistem mengambil data absensi siswa untuk daftar session tersebut.
4. Sistem menggabungkan dengan daftar siswa aktif kelas terpilih.
5. Sistem menghitung agregasi per siswa (H/S/I/A/Belum diisi/%).
6. Sistem menampilkan tabel + metadata posting date + status finalitas.
7. Export Excel memakai dataset yang sama dengan tabel (tanpa query alternatif terpisah).

## UX States
- **Initial state:** sebelum filter valid, tampil instruksi memilih kelas/mapel.
- **Empty state:** tidak ada sesi terposting pada filter aktif.
- **Warning state:** ada `Belum diisi` di satu atau lebih siswa.
- **Ready state:** rekap lengkap siap export.

## Acceptance Criteria
1. Sidebar menampilkan menu `Rekapitulasi KBM` hanya untuk role workspace KBM.
2. Rekap dibatasi kombinasi kelas+mapel terpilih, tidak tercampur lintas kelas.
3. Periode default bulanan, opsi hari ini, dan rentang tanggal berfungsi dengan validasi.
4. Tabel menampilkan kolom wajib sesuai kebutuhan bisnis.
5. Siswa tanpa entri absensi pada sesi tertentu tercatat sebagai `Belum diisi`, bukan `A` otomatis.
6. Tersedia aksi `Perbaiki Data Bolong` untuk mengoreksi data kosong.
7. Download Excel menghasilkan isi data yang sama dengan tabel aktif.
8. Header laporan Excel memuat metadata filter, posting date, dan status finalitas.

## Risks & Mitigation
- **Risk:** query on-demand bisa melambat saat data membesar.
  - **Mitigation:** optimasi query/index di fase berikutnya; tetap jaga payload terfilter ketat.
- **Risk:** user salah tafsir jika ada data belum final.
  - **Mitigation:** badge dan warning eksplisit (`Belum Final`) di UI dan file export.
- **Risk:** koreksi data tanpa jejak audit menimbulkan dispute.
  - **Mitigation:** wajib simpan metadata koreksi (`diubah_pada`, `diubah_oleh`).

## Testing Strategy (High Level)
- Unit test untuk agregasi rekap (H/S/I/A/Belum diisi/%).
- Unit test untuk validator periode (bulanan/hari ini/rentang).
- Integration test service rekap berdasarkan filter kelas+mapel+periode.
- Manual QA:
  - verifikasi data tidak tercampur lintas kelas,
  - verifikasi status `Belum diisi`,
  - verifikasi `Perbaiki Data Bolong`,
  - verifikasi isi Excel cocok dengan tabel aktif.
