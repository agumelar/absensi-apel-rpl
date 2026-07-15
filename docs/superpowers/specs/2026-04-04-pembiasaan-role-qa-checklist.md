# QA Checklist - Workspace Pembiasaan (Role Matrix)

Tanggal: 2026-04-04

## Tujuan

Memastikan akses role, alur submit, cutoff, dan laporan Pembiasaan berjalan sesuai requirement:
- `TU` hanya workspace Pembiasaan,
- `Sapa Pagi` hanya user terjadwal,
- `Pembiasaan` wajib 1x/hari,
- validasi GPS + kamera + note izin/sakit,
- laporan executive terbatasi jurusan untuk `kaprog`.

## Data Setup Minimum

1. Pastikan `pembiasaan_settings` terisi valid (`school_lat`, `school_lng`, `radius_meter`, cutoff).
2. Siapkan akun uji role: `admin`, `guru`, `tu`, `kepsek`, `kesiswaan`, `kaprog`, `kurikulum`.
3. Buat jadwal `sapa_pagi_schedule` pada tanggal hari ini untuk 1 akun guru dan 1 akun TU.
4. Siapkan 1 akun guru/TU yang tidak dijadwalkan untuk validasi pesan no-schedule.

## Matrix Uji Akses per Role

### 1) Admin

- [ ] Login admin langsung ke dashboard admin (tidak lewat `/portal`).
- [ ] Bisa buka workspace Pembiasaan.
- [ ] Bisa akses `Admin · Jadwal Sapa Pagi`.
- [ ] Bisa akses `Admin · Pengaturan Pembiasaan`.
- [ ] Bisa simpan perubahan setting (radius/cutoff).
- [ ] Tidak terblokir di `Sapa Pagi`/`Pembiasaan` bila ikut sebagai peserta.

### 1b) Piket

- [ ] Login piket langsung ke dashboard piket (tidak lewat `/portal`).
- [ ] Menu piket tetap normal (`Koreksi Absen`, `Layanan Piket`, `Histori Layanan`).
- [ ] Tidak diarahkan ke workspace pembiasaan saat login.

### 2) TU

- [ ] Saat login, default route ke `/pembiasaan`.
- [ ] Tidak dapat akses workspace non-pembiasaan.
- [ ] Bisa buka `Dashboard`, `Sapa Pagi`, `Pembiasaan`.
- [ ] Jika tidak terjadwal sapa pagi: muncul pesan "Tidak ada jadwal sapa pagi untuk Anda.".
- [ ] Jika terjadwal: bisa submit Sapa Pagi.

### 3) Guru

- [ ] Bisa buka workspace Pembiasaan.
- [ ] Jika terjadwal: bisa submit Sapa Pagi.
- [ ] Jika tidak terjadwal: no-schedule message muncul.
- [ ] Bisa submit Pembiasaan 1x/hari.

### 4) Executive (`kepsek`, `kesiswaan`, `kurikulum`)

- [ ] Bisa buka `Laporan Pembiasaan`.
- [ ] Bisa lihat semua jurusan (global scope).
- [ ] Export menghasilkan 1 file dengan 4 sheet.

### 5) Kaprog

- [ ] Bisa buka `Laporan Pembiasaan`.
- [ ] Data yang tampil hanya jurusan miliknya.
- [ ] Data jurusan lain tidak muncul di tabel/rekap/export.

## Matrix Uji Validasi Submit

### Sapa Pagi

- [ ] Submit `hadir` tanpa note -> sukses.
- [ ] Submit `izin` tanpa note -> ditolak.
- [ ] Submit `sakit` tanpa note -> ditolak.
- [ ] Submit `izin/sakit` dengan note -> sukses.
- [ ] Submit `hadir` tanpa GPS -> ditolak dengan pesan izin/lokasi.
- [ ] Submit `hadir` tanpa kamera/foto -> ditolak dengan pesan izin kamera.
- [ ] Submit `hadir` di luar radius -> ditolak.
- [ ] Submit `izin/sakit` dari luar radius -> tetap sukses (dengan catatan wajib).
- [ ] Submit setelah cutoff 06:30 -> ditolak.
- [ ] Submit pada Sabtu/Minggu -> ditolak (hari kerja Senin-Jumat).

### Pembiasaan

- [ ] Submit `hadir` tanpa note -> sukses.
- [ ] Submit `izin/sakit` tanpa note -> ditolak.
- [ ] Submit `izin/sakit` dengan note -> sukses.
- [ ] Submit `hadir` wajib GPS + kamera/foto.
- [ ] Submit `izin/sakit` tanpa GPS/foto -> sukses (dengan catatan wajib).
- [ ] Submit setelah cutoff 07:00 -> ditolak.
- [ ] Submit pada Sabtu/Minggu -> ditolak (hari kerja Senin-Jumat).

## Matrix Uji Auto-Alpha

- [ ] Jalankan `fn_finalize_auto_alpha(p_tanggal)` sebelum cutoff -> belum insert alpha.
- [ ] Jalankan setelah cutoff -> alpha terbuat untuk peserta yang belum submit.
- [ ] Jalankan ulang function pada tanggal sama -> tidak membuat duplikat (idempotent).
- [ ] Jalankan untuk tanggal Sabtu/Minggu -> tidak insert alpha.
- [ ] Verifikasi `pg_cron` job weekday aktif untuk auto-alpha cutoff.

## Matrix Uji Laporan + Export

- [ ] `Dashboard Ringkas` menampilkan total sesuai filter.
- [ ] `Rekap Sapa Pagi` hanya data activity `sapa_pagi`.
- [ ] `Rekap Pembiasaan` hanya data activity `pembiasaan`.
- [ ] `Riwayat Detail` menampilkan status/jam/jarak/catatan.
- [ ] Export menghasilkan file tunggal `Laporan_Pembiasaan_<from>_<to>.xlsx`.
- [ ] Sheet export: `Dashboard_Ringkas`, `Rekap_Sapa_Pagi`, `Rekap_Pembiasaan`, `Riwayat_Detail`.

## Matrix Uji Executive 2 Tab + Kalender Sekolah

- [ ] Tab `Monitoring Harian` menampilkan data hanya untuk `Tanggal Fokus`.
- [ ] Tab `Monitoring Harian` tetap mengikuti filter aktivitas + status.
- [ ] Role `kepsek`, `piket`, dan `admin` tidak tampil pada Monitoring Harian.
- [ ] Tab `Rekap Guru` menampilkan kolom: Hadir/Izin/Sakit/Alpha, Total Aktual, Total Kewajiban, Kepatuhan.
- [ ] Role `kepsek`, `piket`, dan `admin` tidak tampil pada Rekap Guru.
- [ ] `Total Aktual` = jumlah H+I+S+A per guru.
- [ ] `Total Kewajiban` berkurang saat tanggal pada rentang ditandai libur sekolah.
- [ ] `% Kepatuhan` sesuai rumus `total_aktual / total_kewajiban`.
- [ ] Export saat tab monitoring aktif menghasilkan sheet `Monitoring_Harian`.
- [ ] Export saat tab rekap aktif menghasilkan sheet `Rekap_Guru`.
- [ ] `fn_finalize_auto_alpha` tidak insert alpha pada tanggal libur sekolah.

## SQL Verifikasi Cepat

```sql
-- 1) Cek settings
select * from public.pembiasaan_settings;

-- 2) Cek jadwal sapa pagi hari ini
select * from public.sapa_pagi_schedule
where tanggal = (timezone('Asia/Jakarta', now()))::date
order by created_at asc;

-- 3) Cek attendance hari ini
select tanggal, activity_type, user_id, status, checkin_at, distance_meter, created_by_system
from public.pembiasaan_attendance
where tanggal = (timezone('Asia/Jakarta', now()))::date
order by activity_type, created_at;

-- 4) Trigger auto alpha manual
select public.fn_finalize_auto_alpha((timezone('Asia/Jakarta', now()))::date);
```
