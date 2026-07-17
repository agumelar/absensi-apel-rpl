# Requirements Document

## Introduction

Fitur **Kalender Pendidikan Upload** menambahkan kemampuan unggah massal hari libur ke halaman admin Kalender Sekolah pada aplikasi absensi "ASIK" (SMKN 1 Rongga). Saat ini admin harus memasukkan setiap tanggal libur satu per satu secara manual, sedangkan kalender pendidikan resmi berbentuk rentang tanggal (mis. "Libur Semester Ganjil: 23 Des 2025 – 4 Jan 2026").

Fitur ini memungkinkan admin mengunduh template Excel terstruktur berbasis rentang, mengisinya dari kalender pendidikan resmi, lalu mengunggahnya. Sistem mem-parsing file, memvalidasi isi, meledakkan (expand) setiap rentang menjadi baris harian, menampilkan pratinjau (preview) yang membedakan tanggal baru dan tanggal yang menimpa data lama, lalu menulis secara batch ke tabel `school_calendar` (upsert `onConflict 'tanggal'`) setelah admin mengonfirmasi.

Fitur ini adalah tambahan: input manual per tanggal yang lama tetap dipertahankan untuk koreksi kecil, dan fitur ini hanya menandai hari libur (`is_libur = true`). Hari aktif tetap implisit (hari kerja yang tidak ditandai libur), dan akhir pekan (Sabtu–Minggu) tetap ditangani otomatis sebagai libur oleh aplikasi.

## Glossary

- **ASIK**: Aplikasi absensi sekolah SMKN 1 Rongga (React 19 + Vite + Supabase), tempat fitur ini berada.
- **Upload_Feature**: Bagian antarmuka dan logika baru pada halaman Kalender Sekolah yang menangani unduh template, unggah, validasi, pratinjau, dan penyimpanan batch hari libur.
- **Template_Generator**: Komponen yang menghasilkan dan mengunduh file template Excel berformat rentang.
- **Excel_Parser**: Komponen yang membaca file Excel/CSV yang diunggah menjadi baris data terstruktur (memakai `readExcelFileToJson` dari `excelService.js`).
- **Validator**: Komponen yang memeriksa struktur dan isi baris hasil parsing terhadap aturan yang berlaku.
- **Range_Expander**: Komponen yang mengubah setiap baris rentang (`tanggal_mulai`, `tanggal_selesai`, `keterangan`) menjadi kumpulan baris harian.
- **Preview_Panel**: Komponen antarmuka yang menampilkan ringkasan dan daftar tanggal hasil expand sebelum penyimpanan.
- **Batch_Writer**: Komponen yang menulis baris harian ke `school_calendar` secara batch menggunakan upsert dengan `onConflict 'tanggal'`.
- **school_calendar**: Tabel Supabase existing berisi kolom `id`, `tanggal` (unik), `is_libur` (boolean), `keterangan` (text nullable), `updated_at`.
- **Manual_Entry**: Form input satu-tanggal-per-satu existing pada halaman Kalender Sekolah yang tetap dipertahankan.
- **Range_Row**: Satu baris pada file unggahan dengan kolom `tanggal_mulai`, `tanggal_selesai`, dan `keterangan`.
- **Daily_Record**: Satu baris harian hasil expand berisi `tanggal` (satu hari), `is_libur = true`, dan `keterangan`.
- **New_Date**: Tanggal hasil expand yang belum ada di `school_calendar`.
- **Overwrite_Date**: Tanggal hasil expand yang sudah ada di `school_calendar` dan akan ditimpa.
- **Admin**: Pengguna dengan role `admin`, satu-satunya role yang dapat mengakses halaman Kalender Sekolah.
- **WIB**: Zona waktu Asia/Jakarta (UTC+7) yang dipakai untuk seluruh perhitungan tanggal.
- **ISO_Date**: Tanggal berformat `YYYY-MM-DD` yang dipakai sebagai nilai kolom `tanggal` di `school_calendar`.
- **Weekend_Date**: Tanggal yang jatuh pada hari Sabtu atau Minggu menurut kalender WIB.
- **Max_Range_Span**: Batas maksimum jumlah hari dalam satu Range_Row, yaitu 400 hari.

## Requirements

### Requirement 1: Akses Khusus Admin

**User Story:** Sebagai admin, saya ingin fitur unggah kalender hanya tersedia bagi role admin, sehingga tanggal libur yang berdampak ke seluruh modul absensi tidak dapat diubah oleh peran lain.

#### Acceptance Criteria

1. WHERE pengguna memiliki role `admin`, THE Upload_Feature SHALL menampilkan kontrol unduh template dan unggah file pada halaman Kalender Sekolah.
2. IF pengguna tanpa role `admin` mencoba mengakses halaman Kalender Sekolah, THEN THE ASIK SHALL menolak akses dan tidak menampilkan Upload_Feature.
3. WHEN pengguna tanpa role `admin` memicu operasi penyimpanan batch, THEN THE Batch_Writer SHALL menolak operasi dan tidak menulis ke `school_calendar`.
4. WHERE pengguna memiliki role `admin`, THE ASIK SHALL memberikan akses ke halaman Kalender Sekolah tanpa pengecualian.

### Requirement 2: Unduh Template Excel

**User Story:** Sebagai admin, saya ingin mengunduh template Excel berformat rentang, sehingga saya tahu format kolom yang benar untuk menyalin isi kalender pendidikan PDF.

#### Acceptance Criteria

1. WHEN Admin menekan tombol unduh template, THE Template_Generator SHALL menghasilkan file Excel `.xlsx` yang berisi baris header dengan kolom `tanggal_mulai`, `tanggal_selesai`, dan `keterangan`.
2. THE Template_Generator SHALL menyertakan minimal satu baris contoh yang menampilkan rentang tanggal berformat `YYYY-MM-DD` dan keterangan contoh.
3. WHEN Template_Generator menghasilkan file, THE Template_Generator SHALL memicu unduhan berkas dengan nama file yang mengandung kata `template` dan `kalender`.
4. THE Template_Generator SHALL menyusun header kolom sehingga hasil normalisasi header oleh Excel_Parser menghasilkan kunci `tanggal_mulai`, `tanggal_selesai`, dan `keterangan`.
5. IF mekanisme unduhan berkas gagal, THEN THE Template_Generator SHALL tidak menyimpan berkas secara lokal dan menampilkan pesan galat dalam Bahasa Indonesia.

### Requirement 3: Unggah dan Parsing File

**User Story:** Sebagai admin, saya ingin mengunggah file Excel yang sudah saya isi, sehingga sistem dapat membaca daftar rentang libur dari file tersebut.

#### Acceptance Criteria

1. WHEN Admin memilih berkas berekstensi `.xlsx` atau `.csv`, THE Excel_Parser SHALL membaca sheet pertama menjadi kumpulan Range_Row dengan header yang dinormalisasi ke snake_case.
2. IF berkas yang dipilih bukan `.xlsx` atau `.csv`, THEN THE Validator SHALL menolak berkas dan menampilkan pesan "Format berkas tidak didukung. Unggah berkas Excel (.xlsx) atau CSV (.csv)." dalam Bahasa Indonesia.
3. WHILE Excel_Parser sedang membaca berkas, THE Upload_Feature SHALL menampilkan indikator proses dan menonaktifkan tombol simpan.
4. WHEN Excel_Parser selesai membaca, THE Excel_Parser SHALL mengabaikan setiap baris yang seluruh selnya kosong.
5. IF berkas tidak memiliki baris data setelah baris header, THEN THE Validator SHALL menampilkan pesan "Berkas tidak berisi data tanggal. Periksa kembali isi berkas." dan tidak melanjutkan ke pratinjau.

### Requirement 4: Validasi Isi Berkas

**User Story:** Sebagai admin, saya ingin sistem memvalidasi isi berkas dan memberi pesan kesalahan yang jelas dalam Bahasa Indonesia, sehingga saya dapat memperbaiki isi berkas sebelum data ditulis.

#### Acceptance Criteria

1. IF hasil parsing tidak memuat kolom `tanggal_mulai` atau `tanggal_selesai`, THEN THE Validator SHALL menampilkan pesan yang menyebutkan nama kolom yang hilang dan tidak melanjutkan ke pratinjau.
2. WHEN Validator memeriksa nilai tanggal, THE Validator SHALL menerima nilai berformat `YYYY-MM-DD` dan `DD/MM/YYYY` serta mengubahnya menjadi ISO_Date.
3. IF sebuah Range_Row memiliki `tanggal_mulai` atau `tanggal_selesai` yang tidak dapat dikenali sebagai tanggal yang valid, THEN THE Validator SHALL menandai baris tersebut sebagai galat dengan pesan yang menyebutkan nomor baris dan nilai yang bermasalah.
4. IF sebuah Range_Row memiliki `tanggal_selesai` yang lebih awal daripada `tanggal_mulai`, THEN THE Validator SHALL menandai baris tersebut sebagai galat dengan pesan yang menyebutkan nomor baris.
5. IF sebuah Range_Row menghasilkan rentang yang melebihi Max_Range_Span, THEN THE Validator SHALL menandai baris tersebut sebagai galat dengan pesan yang menyebutkan nomor baris dan batas maksimum.
6. WHEN sebuah Range_Row memiliki `keterangan` kosong, THE Validator SHALL menerima baris tersebut dan memakai nilai keterangan kosong sebagai `null`.
7. IF satu atau lebih Range_Row ditandai sebagai galat, THEN THE Upload_Feature SHALL menampilkan seluruh pesan galat dan tidak menulis satu baris pun ke `school_calendar`.

### Requirement 5: Expand Rentang menjadi Baris Harian

**User Story:** Sebagai admin, saya ingin setiap rentang tanggal dipecah otomatis menjadi baris harian, sehingga saya tidak perlu menuliskan setiap hari libur satu per satu.

#### Acceptance Criteria

1. WHEN Range_Expander memproses sebuah Range_Row yang valid, THE Range_Expander SHALL menghasilkan satu Daily_Record untuk setiap tanggal dari `tanggal_mulai` hingga `tanggal_selesai` secara inklusif.
2. WHEN Range_Expander menghasilkan sebuah Daily_Record, THE Range_Expander SHALL menetapkan `is_libur` bernilai `true` dan `keterangan` sama dengan keterangan Range_Row asal.
3. WHERE `tanggal_mulai` sama dengan `tanggal_selesai` pada sebuah Range_Row, THE Range_Expander SHALL menghasilkan tepat satu Daily_Record.
4. WHEN Range_Expander menemui sebuah Weekend_Date di dalam rentang, THE Range_Expander SHALL melewati tanggal tersebut dan tidak menghasilkan Daily_Record untuknya.
5. IF dua atau lebih Range_Row menghasilkan Daily_Record dengan ISO_Date yang sama, THEN THE Range_Expander SHALL menyatukannya menjadi satu Daily_Record dengan mempertahankan keterangan dari Range_Row terakhir yang diproses.
6. WHEN Range_Expander menghitung tanggal harian, THE Range_Expander SHALL memakai kalender WIB sehingga tidak terjadi pergeseran satu hari akibat zona waktu.
7. IF perhitungan kalender WIB tidak tersedia, THEN THE Range_Expander SHALL memakai zona waktu sistem sebagai cadangan dan menampilkan peringatan kepada Admin.

### Requirement 6: Pratinjau dan Konfirmasi

**User Story:** Sebagai admin, saya ingin melihat pratinjau tanggal yang akan ditandai libur sebelum disimpan, sehingga saya dapat memastikan dampaknya benar sebelum menulis ke basis data produksi.

#### Acceptance Criteria

1. WHEN Range_Expander selesai tanpa galat, THE Preview_Panel SHALL menampilkan jumlah total Daily_Record yang akan ditandai libur.
2. THE Preview_Panel SHALL menampilkan daftar tanggal Daily_Record beserta keterangannya sebelum penyimpanan.
3. WHEN Preview_Panel menampilkan daftar, THE Preview_Panel SHALL menandai setiap Daily_Record sebagai New_Date atau Overwrite_Date berdasarkan keberadaannya di `school_calendar`.
4. THE Preview_Panel SHALL menampilkan jumlah New_Date dan jumlah Overwrite_Date secara terpisah.
5. THE Batch_Writer SHALL menulis ke `school_calendar` hanya setelah Admin menekan aksi konfirmasi pada Preview_Panel.
6. WHEN Admin membatalkan pada Preview_Panel, THE Upload_Feature SHALL membuang hasil pratinjau dan tidak menulis apa pun ke `school_calendar`.
7. IF sesi Admin terputus atau berakhir selagi Preview_Panel ditampilkan, THEN THE Batch_Writer SHALL tidak menulis apa pun ke `school_calendar` tanpa aksi konfirmasi eksplisit.

### Requirement 7: Penyimpanan Batch dengan Penanganan Timpa

**User Story:** Sebagai admin, saya ingin seluruh hari libur ditulis secara efisien dalam satu proses dan tanggal yang sudah ada ditimpa, sehingga penyimpanan cepat dan konsisten pada Supabase free tier.

#### Acceptance Criteria

1. WHEN Admin mengonfirmasi penyimpanan, THE Batch_Writer SHALL menulis seluruh Daily_Record ke `school_calendar` memakai upsert dengan `onConflict 'tanggal'`.
2. WHEN Batch_Writer menyusun payload sebuah Daily_Record, THE Batch_Writer SHALL menyertakan `tanggal` sebagai ISO_Date, `is_libur = true`, `keterangan`, dan `updated_at` bernilai stempel waktu saat ini.
3. WHERE jumlah Daily_Record melebihi 500, THE Batch_Writer SHALL membagi penulisan menjadi beberapa batch berukuran maksimum 500 baris per permintaan.
4. WHEN seluruh operasi unggah selesai dengan seluruh batch berhasil ditulis, THE Upload_Feature SHALL menampilkan pesan berhasil yang menyebutkan jumlah tanggal yang ditulis dan memuat ulang daftar kalender.
5. IF penulisan sebuah batch gagal, THEN THE Upload_Feature SHALL menampilkan pesan galat dalam Bahasa Indonesia yang menyebutkan penyebab kegagalan dan tidak menampilkan pesan berhasil.
6. IF penulisan batch gagal setelah Admin mengonfirmasi, THEN THE Upload_Feature SHALL menyimpan hasil pratinjau di memori sehingga Admin dapat mengulang konfirmasi tanpa mengunggah ulang berkas.
7. WHERE logika pembagian batch tidak aktif, THE Batch_Writer SHALL tetap mencoba menulis seluruh Daily_Record dalam satu permintaan.

### Requirement 8: Koeksistensi dengan Input Manual

**User Story:** Sebagai admin, saya ingin tetap dapat menambah atau menghapus satu tanggal secara manual seperti sebelumnya, sehingga saya dapat melakukan koreksi kecil tanpa mengunggah berkas.

#### Acceptance Criteria

1. THE ASIK SHALL tetap menyediakan Manual_Entry untuk menambah satu tanggal pada halaman Kalender Sekolah setelah Upload_Feature ditambahkan.
2. THE ASIK SHALL tetap menyediakan aksi hapus per baris pada daftar `school_calendar` setelah Upload_Feature ditambahkan.
3. WHEN Batch_Writer menulis Daily_Record ke `school_calendar`, THE Batch_Writer SHALL memakai skema kolom yang sama dengan Manual_Entry (`tanggal`, `is_libur`, `keterangan`, `updated_at`) dan strategi `onConflict 'tanggal'` yang sama.
4. WHEN penyimpanan batch selesai, THE ASIK SHALL menampilkan tanggal hasil unggahan dan tanggal hasil Manual_Entry pada daftar yang sama tanpa membedakan sumbernya.
5. WHILE penyimpanan batch sedang berlangsung, THE ASIK SHALL tetap menyediakan Manual_Entry bagi Admin.
6. IF payload Daily_Record tidak memenuhi skema kolom `school_calendar`, THEN THE Batch_Writer SHALL memblokir penulisan batch hingga konsistensi skema terverifikasi.

### Requirement 9: Tidak Mengganggu Modul Absensi Lain

**User Story:** Sebagai pengelola sistem, saya ingin fitur unggah tidak mengubah cara modul absensi membaca hari libur, sehingga perilaku apel, mapel, dan pembiasaan tetap sama.

#### Acceptance Criteria

1. THE Batch_Writer SHALL menulis hanya baris dengan `is_libur = true` dan tidak menulis baris hari aktif ke `school_calendar`.
2. THE Upload_Feature SHALL tidak mengubah nilai kolom, nama tabel, atau kunci konflik yang dibaca oleh modul absensi existing dari `school_calendar`.
3. WHERE sebuah Weekend_Date tidak ditulis ke `school_calendar` oleh Batch_Writer, THE ASIK SHALL tetap memperlakukan Weekend_Date sebagai libur melalui perilaku otomatis akhir pekan yang sudah ada.
