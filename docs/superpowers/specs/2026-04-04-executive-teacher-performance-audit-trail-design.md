# Executive Sprint Design - Teacher Performance & Audit Trail

Tanggal: 2026-04-04  
Scope: Sprint Executive (1-2 minggu) untuk modul `Teacher Performance` dan `Audit Trail Mapel`.

## 1. Context dan Keputusan Scope

### 1.1 Yang dikerjakan
- Fokus sprint hanya pada 2 menu executive:
  - `Teacher Performance`
  - `Audit Trail Mapel`
- Prioritas hasil:
  1) Akurasi KPI  
  2) Laporan/export  
  3) Alert dan tindak lanjut  
  4) UX dashboard

### 1.2 Yang tidak dikerjakan
- `Executive Control` untuk `kesiswaan` tidak diubah (stabil, out of scope sprint ini).
- Perubahan struktur besar schema/anggaran backend level lanjut ditunda.

### 1.3 RBAC final sprint ini
- Role yang bisa akses `Teacher Performance` dan `Audit Trail Mapel`: `kepsek`, `kaprog`, `kurikulum`.
- Aturan visibilitas:
  - `kaprog`: hanya data pada `jurusan_id` miliknya.
  - `kepsek` dan `kurikulum`: akses global lintas jurusan.

## 2. KPI Contract (Source of Truth)

Pendekatan yang dipakai: **hybrid per metrik** agar setiap KPI memakai sumber paling tepat, namun tetap konsisten lintas UI/export/alert.

### 2.1 KPI wajib (must-have)
1. Presence rate guru mapel
2. Late check-in rate (toleransi 15 menit)
3. Tidak Masuk rate
4. SLA Guru Kosong breach rate
5. Kelas terdampak per hari/minggu
6. Tren per mapel/kelas/guru

### 2.2 Definisi formula

#### A. Presence rate guru
- Numerator: jumlah sesi status `Hadir` pada filter aktif.
- Denominator: total sesi terjadwal pada filter aktif.
- Basis data:
  - `session.status`
  - `schedule` (untuk denominator jadwal)

#### B. Late check-in rate
- Numerator: jumlah sesi `Hadir` dengan `waktu_check_in > (jam_mulai + 15 menit)`.
- Denominator: total sesi `Hadir` yang memiliki basis jam mulai valid.
- Basis data:
  - `schedule.jam_mulai`
  - `session.waktu_check_in`

#### C. Tidak Masuk rate
- Numerator: jumlah sesi status `Tidak Masuk`.
- Denominator: total sesi terjadwal pada filter aktif.
- Basis data:
  - `session.status`
  - `schedule`

#### D. SLA Guru Kosong breach rate
- Numerator: jumlah slot jadwal yang hingga menit ke-16 belum memiliki check-in valid.
- Denominator: total slot jadwal aktif dalam rentang analisis.
- Basis data:
  - `schedule` (slot ekspektasi)
  - `session.waktu_check_in` (realisasi)

#### E. Kelas terdampak per hari/minggu
- Nilai: jumlah `distinct kelas_id` yang mengalami breach SLA dalam bucket harian/mingguan.
- Basis data:
  - hasil derivatif join `schedule + session` berorientasi SLA

#### F. Tren per mapel/kelas/guru
- Time-series per bucket (harian/mingguan) untuk KPI A-D dengan dimensi switchable (`mapel`, `kelas`, `guru`).
- Dataset tren memakai rule formula yang sama dengan summary KPI agar tidak drift.

### 2.3 Aturan konsistensi angka
- Angka pada kartu, tabel detail, export Excel, dan alert harus berasal dari dataset KPI yang sama (bukan query terpisah dengan rule berbeda).
- Timezone standar: WIB untuk seluruh filter, agregasi bucket, dan label tampilan.

## 3. Arsitektur Solusi

### 3.1 Lapisan service
- Tambah lapisan agregasi KPI tunggal (mis. `mapelKpiService`) sebagai producer metrik executive.
- Tambah/rapikan resolver scope role (mis. `executiveScopeService`) untuk membentuk batas query sebelum KPI dihitung.

### 3.2 Scope resolver (RBAC-aware)
- Input: user session (`role`, `jurusan_id`) + filter halaman.
- Output: query scope final.
- Rule:
  - `kaprog`: `jurusan_id` wajib valid dan selalu di-inject ke scope.
  - `kepsek`, `kurikulum`: scope global tanpa filter jurusan paksa.
- Jika `kaprog` tidak memiliki `jurusan_id` valid: fail-fast dengan error scope.

### 3.3 Consumer halaman

#### Teacher Performance
- Mengonsumsi dataset KPI agregat untuk:
  - summary cards,
  - tabel performa guru,
  - grafik tren (dimensi mapel/kelas/guru).
- UI tidak melakukan kalkulasi ulang formula inti; UI hanya format/label.

#### Audit Trail Mapel
- Tetap session-centric sebagai sumber bukti operasional.
- Menampilkan ringkasan KPI kontekstual berdasarkan filter aktif (tanpa mengubah fungsi utama audit trail).
- Sinkron dengan scope RBAC yang sama.

### 3.4 Filter contract seragam
- `fromDate`
- `toDate`
- `kelasId` (opsional)
- `mapelId` (opsional)
- `guruId` (opsional)
- role scope otomatis via scope resolver

## 4. Data Flow

1. Halaman mengirim filter aktif.
2. Scope resolver membentuk batas akses berdasarkan role.
3. KPI service menghitung metrik dari source hybrid (`schedule`, `session`, dan relasi terkait).
4. Dataset yang sama dipakai untuk:
   - render UI,
   - export Excel,
   - alert SLA.
5. Audit Trail mengambil detail sesi + ringkasan KPI filter aktif dari kontrak yang sama.

## 5. Error Handling & Reliability

### 5.1 Kategori state
- **Data kosong valid**: tampil empty-state informatif, bukan error.
- **Error query**: tampil pesan gagal load + aksi `Coba Lagi`.
- **Error scope role**: tampil pesan akses/scope tidak valid (khususnya `kaprog` tanpa jurusan valid).

### 5.2 Guard reliability
- Untuk alert SLA, jika data parsial/tidak lengkap, tampil indikator data belum lengkap agar tidak menyesatkan keputusan.
- Export tetap disable jika dataset kosong/invalid.

## 6. Testing Strategy

### 6.1 Unit tests
- Formula KPI:
  - presence rate,
  - late check-in rate (15 menit),
  - tidak masuk rate,
  - SLA breach,
  - impacted classes,
  - trend aggregation.
- Scope resolver:
  - `kaprog` terfilter jurusan,
  - `kepsek/kurikulum` global.

### 6.2 Integration tests
- Konsistensi angka lintas:
  - summary card,
  - tabel,
  - export.
- Validasi `Audit Trail` tetap session-centric setelah penambahan KPI context.

### 6.3 Regression tests
- `Executive Control` (`kesiswaan`) tidak berubah.
- Existing alur export/monitoring yang sudah stabil tidak regress.

### 6.4 Verification commands
- `npm run test:unit`
- `npm run lint`
- `npm run build`
- `npm test`

## 7. Delivery Plan (Sprint 1-2 Minggu)

### Hari 1-2
- Finalisasi KPI contract + implementasi scope resolver role-aware + unit test formula inti.

### Hari 3-4
- Integrasi `Teacher Performance` ke dataset KPI tunggal (summary, tabel, tren).

### Hari 5
- Export `Teacher Performance` dari dataset yang sama.

### Hari 6-7
- Integrasi `Audit Trail` dengan KPI context + parity angka UI/export.

### Hari 8
- Implementasi alert & tindak lanjut berbasis dataset SLA yang sama.

### Hari 9-10
- Hardening, regression check, dan verifikasi akhir lint/build/test.

## 8. Definition of Done

- `Teacher Performance` dan `Audit Trail` menggunakan KPI contract yang sama.
- Angka konsisten antara UI, tabel, alert, dan export.
- `kaprog` terbatas jurusan miliknya; `kepsek/kurikulum` global.
- `Executive Control` kesiswaan tidak terdampak.
- Semua gate verifikasi lulus.

## 9. Risiko dan Mitigasi

- Risiko: mismatch data historis (format status lama/baru) memengaruhi agregasi.
  - Mitigasi: normalisasi status eksplisit di service sebelum agregasi KPI.
- Risiko: drift formula antara halaman saat maintenance.
  - Mitigasi: semua formula dipusatkan di KPI service + coverage test formula.
- Risiko: scope `kaprog` tidak lengkap karena session lama.
  - Mitigasi: fail-fast + fallback fetch profile jika diperlukan, lalu update kontrak session.

## 10. Out-of-Scope Explicit

- Refactor total DB schema.
- Perubahan kebijakan budget/storage besar.
- Perombakan besar UI `Executive Control` milik `kesiswaan`.
