-- Audit data absensi mapel yang tercampur lintas kelas
-- (siswa.kelas_id berbeda dengan kelas pada schedule session)

select
  sam.id as attendance_id,
  sam.session_id,
  sam.siswa_id,
  sam.status,
  sam.created_at,
  s.nama_siswa,
  s.nis,
  s.kelas_id as siswa_kelas_id,
  sc.kelas_id as session_kelas_id,
  mk.nama_kelas as session_kelas_nama
from public.student_attendance_mapel sam
join public.siswa s on s.id = sam.siswa_id
join public.session se on se.id = sam.session_id
join public.schedule sc on sc.id = se.schedule_id
left join public.master_kelas mk on mk.id = sc.kelas_id
where s.kelas_id is distinct from sc.kelas_id
order by sam.created_at desc;
