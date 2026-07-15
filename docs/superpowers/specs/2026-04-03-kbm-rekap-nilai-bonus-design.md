# KBM Rekap Nilai Bonus Design

## Context
- Workspace KBM sudah memiliki menu `Nilai Harian` untuk input nilai per sesi, namun belum memiliki rekap periodik yang menjelaskan pola penilaian bonus per siswa.
- Nilai harian pada konteks ini bersifat **bonus keaktifan** (opsional), bukan nilai wajib setiap pertemuan.
- Karena sifatnya opsional, siswa yang tidak dinilai pada periode tertentu tidak boleh dianggap error/data bolong.

## Goals
- Menyediakan rekap nilai bonus per kombinasi `Kelas -> Mapel -> Periode` di halaman `Nilai Harian`.
- Menyediakan metrik yang adil untuk skema bonus: frekuensi penilaian, cakupan penilaian, total poin, dan rata-rata saat diberi nilai.
- Menyediakan export Excel yang 1:1 dengan tabel rekap aktif.

## Non-Goals
- Tidak mengubah alur input nilai harian per sesi yang sudah berjalan.
- Tidak menambahkan kewajiban nilai minimum per siswa.
- Tidak mengubah model data `daily_score` di luar kebutuhan query rekap.

## Business Rule (Locked)
- Nilai harian = **bonus/opsional**.
- Siswa tanpa nilai pada sebagian/semua pertemuan adalah kondisi valid.
- Tidak ada auto-penalti (bukan nol otomatis untuk sesi yang tidak dinilai).

## Functional Design

### 1) Filter Rekap
- Filter mengikuti pola rekap kehadiran:
  - Kelas
  - Mapel
  - Periode (`Hari Ini`, `Bulanan`, `Rentang Tanggal`)
- Data hanya dimuat saat user klik `Terapkan Rekap`.

### 2) Metrik Rekap Per Siswa
- `Total Pertemuan`: jumlah sesi pada periode aktif.
- `Frekuensi Dinilai`: jumlah sesi siswa memperoleh nilai bonus.
- `Cakupan Penilaian (%)`: `frekuensi_dinilai / total_pertemuan * 100`.
- `Total Poin`: akumulasi nilai bonus siswa pada periode aktif.
- `Rata-rata Saat Diberi Nilai`: `total_poin / frekuensi_dinilai`; jika frekuensi 0 tampil `-`.
- `Keterangan`:
  - `Sudah pernah dinilai` jika `frekuensi_dinilai > 0`.
  - `Belum pernah dinilai` jika `frekuensi_dinilai = 0`.

### 3) KPI Rekap
- Ringkasan level periode:
  - Total Pertemuan
  - Siswa Dinilai
  - Siswa Belum Dinilai
  - Rata-rata Cakupan Penilaian

### 4) Excel Export
- Tombol `Download Excel Rekap` tersedia setelah rekap diterapkan.
- Excel mengikuti dataset rekap aktif (tanpa query alternatif terpisah).
- Metadata header:
  - Kelas
  - Mapel
  - Periode
  - Total Pertemuan
  - Jenis Rekap: `Nilai Keaktifan (Bonus / Opsional)`
- Kolom tabel export:
  - `No`, `Nama`, `NIS`, `Total Pertemuan`, `Frekuensi Dinilai`, `Cakupan Penilaian (%)`, `Total Poin`, `Rata-rata Saat Diberi Nilai`, `Keterangan`.

## Data Flow (On-Demand)
1. User pilih filter rekap dan klik `Terapkan Rekap`.
2. Sistem validasi akses guru untuk kombinasi kelas+mapel.
3. Sistem mengambil daftar sesi periode aktif.
4. Sistem mengambil siswa aktif kelas dan data `daily_score` untuk session terkait.
5. Sistem hitung agregasi rekap bonus per siswa.
6. UI menampilkan KPI + tabel rekap.
7. Export Excel memakai dataset rekap yang sama dengan tabel.

## Acceptance Criteria
1. Rekap nilai bonus tersedia di halaman `Nilai Harian` dengan filter kelas/mapel/periode.
2. Siswa tanpa nilai pada periode aktif tetap tampil sebagai data valid (`Belum pernah dinilai`).
3. Tabel menampilkan metrik bonus sesuai rule yang disepakati.
4. Export Excel menampilkan data yang sama dengan tabel rekap aktif.
5. Label UX menggunakan istilah operasional yang jelas (`Cakupan Penilaian`, `Rata-rata Saat Diberi Nilai`, dst).

## Testing Strategy (High Level)
- Unit test rule agregasi rekap bonus (kasus siswa dinilai penuh/parsial/tidak sama sekali).
- Unit test formatter/export row mapping untuk stabilitas kolom.
- Manual QA:
  - validasi hasil rekap lintas mode periode,
  - validasi export Excel sesuai tampilan,
  - validasi keterangan siswa tanpa nilai.
