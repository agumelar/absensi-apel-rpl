-- HAPUS data absensi mapel yang lintas kelas (cleanup aman berbasis relasi kelas)
--
-- Langkah aman:
-- 1) Jalankan dulu file audit_attendance_cross_class.sql untuk review
-- 2) Jika hasilnya sesuai, jalankan DELETE di bawah

delete from public.student_attendance_mapel sam
using public.siswa s, public.session se, public.schedule sc
where sam.siswa_id = s.id
  and sam.session_id = se.id
  and se.schedule_id = sc.id
  and s.kelas_id is distinct from sc.kelas_id;

-- Verifikasi pasca delete
select count(*) as remaining_cross_class_rows
from public.student_attendance_mapel sam
join public.siswa s on s.id = sam.siswa_id
join public.session se on se.id = sam.session_id
join public.schedule sc on sc.id = se.schedule_id
where s.kelas_id is distinct from sc.kelas_id;
