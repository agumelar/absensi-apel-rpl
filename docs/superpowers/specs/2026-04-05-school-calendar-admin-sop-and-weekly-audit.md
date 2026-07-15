# SOP Admin Kalender Sekolah + Audit Mingguan Absensi

## Tujuan
- Menjaga konsistensi policy hari aktif sekolah di seluruh modul absensi (pembiasaan, mapel, executive).
- Mencegah salah hitung kewajiban, alpha, dan metrik performa karena kalender tidak terkelola.

## SOP Operasional Admin (Kalender Sekolah)

### 1) Frekuensi Update
- Minimal 1x per bulan sebelum bulan berjalan dimulai.
- Wajib update tambahan saat ada pengumuman libur mendadak (event sekolah, kebijakan dinas, force majeure).

### 2) Data Wajib Saat Input Kalender
- `tanggal` (unik, format YYYY-MM-DD).
- `status` (`Libur` atau `Aktif`).
- `keterangan` (wajib secara operasional untuk audit internal).

### 3) Alur Input Standar
1. Buka menu Admin `Kalender Sekolah`.
2. Input tanggal + status + keterangan.
3. Simpan.
4. Verifikasi tanggal tampil pada tabel kalender.
5. Lakukan sampling cepat pada laporan mapel/pembiasaan untuk memastikan angka menyesuaikan.

### 4) Aturan Perubahan Data
- Perubahan tanggal masa depan: boleh langsung diubah.
- Perubahan tanggal lampau yang sudah punya data absensi: harus didampingi catatan alasan perubahan dan validasi dampak.
- Jika terjadi perubahan massal, lakukan re-check metrik mingguan setelah update.

### 5) Kontrol Akses
- Hanya role `admin` yang boleh CRUD kalender.
- Role lain read-only melalui laporan.

## Checklist Audit Mingguan (Lintas Modul)

### A. Kalender Sekolah
- [ ] Tidak ada duplikasi tanggal.
- [ ] Semua tanggal libur minggu berjalan sudah terinput.
- [ ] Semua tanggal punya keterangan operasional.

### B. Pembiasaan
- [ ] `fn_finalize_auto_alpha` tidak menambah alpha pada tanggal libur sekolah.
- [ ] Rekap guru pembiasaan: `total_kewajiban` sudah exclude tanggal libur.
- [ ] Monitoring harian tidak menampilkan kewajiban pada tanggal libur.

### C. Mapel
- [ ] Rekap kehadiran mapel: `total_pertemuan` hanya dari hari aktif sekolah.
- [ ] Rekap nilai mapel: denominator per sesi hanya dari hari aktif sekolah.
- [ ] Executive mapel daily monitor kosong pada tanggal libur.

### D. Executive / Export
- [ ] Angka ringkasan halaman = angka export (sample 1-2 periode).
- [ ] Metadata export menyebut kebijakan exclusion hari libur.

## Query Sampling Historis (SQL)

### 1) Cek alpha sistem pada tanggal libur sekolah (harus 0)
```sql
select
  pa.tanggal,
  pa.activity_type,
  count(*) as total_alpha_system
from public.pembiasaan_attendance pa
join public.school_calendar sc on sc.tanggal = pa.tanggal and sc.is_libur = true
where pa.created_by_system = true
  and pa.status = 'alpha'
group by pa.tanggal, pa.activity_type
order by pa.tanggal desc, pa.activity_type;
```

### 2) Cek sesi mapel pada tanggal libur sekolah (harus tidak ikut agregasi KPI/rekap)
```sql
select
  s.tanggal,
  count(*) as total_session
from public.session s
join public.school_calendar sc on sc.tanggal = s.tanggal and sc.is_libur = true
group by s.tanggal
order by s.tanggal desc;
```

### 3) Cek tanggal libur vs weekend (deteksi input anomali)
```sql
select
  tanggal,
  extract(isodow from tanggal) as iso_dow,
  is_libur,
  keterangan
from public.school_calendar
order by tanggal desc
limit 90;
```

## Tindakan Jika Audit Gagal
- Bekukan perubahan kalender sampai akar masalah jelas.
- Catat tanggal terdampak dan modul terdampak.
- Jalankan sampling ulang setelah perbaikan.
- Catat insiden di log sprint agar jejak perubahan tetap jelas.
