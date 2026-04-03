-- Gunakan file ini di Supabase SQL Editor untuk investigasi mismatch
-- ringkasan absensi (contoh: total siswa terlihat terlalu besar).
--
-- Cara pakai cepat:
-- 1) Ganti 'REPLACE_SESSION_ID_UUID' pada CTE params (di tiap blok)
-- 2) Jalankan per blok atau langsung semua query

-- =====================================================
-- 1) CEK TOTAL ROW VS JUMLAH SISWA UNIK
-- =====================================================
with params as (
  select 'REPLACE_SESSION_ID_UUID'::uuid as session_id
)
select
  count(*) as total_rows,
  count(distinct sam.siswa_id) as distinct_siswa
from public.student_attendance_mapel sam
join params p on sam.session_id = p.session_id;

-- =====================================================
-- 2) CEK DUPLIKASI SISWA DALAM 1 SESSION
-- (kalau query ini mengembalikan row, ada double input)
-- =====================================================
with params as (
  select 'REPLACE_SESSION_ID_UUID'::uuid as session_id
)
select
  sam.siswa_id,
  count(*) as cnt
from public.student_attendance_mapel sam
join params p on sam.session_id = p.session_id
group by sam.siswa_id
having count(*) > 1
order by cnt desc, sam.siswa_id;

-- =====================================================
-- 3) CEK DETAIL BARIS ABSENSI PADA SESSION TERSEBUT
-- (untuk audit status_siswa/kelas saat ini dan urutan created_at)
-- =====================================================
  with params as (
    select 'REPLACE_SESSION_ID_UUID'::uuid as session_id
  )
  select
    sam.id as attendance_id,
    sam.session_id,
    sam.siswa_id,
    sam.status as status_absensi,
    sam.created_at,
    s.nama_siswa,
    s.nis,
    s.status_siswa,
    s.kelas_id
  from public.student_attendance_mapel sam
  left join public.siswa s on s.id = sam.siswa_id
  join params p on sam.session_id = p.session_id
  order by s.nama_siswa nulls last, sam.created_at;

-- =====================================================
-- 4) (OPSIONAL) CEK DUPLIKASI GLOBAL SEMUA SESSION
-- =====================================================
select
  session_id,
  siswa_id,
  count(*) as cnt
from public.student_attendance_mapel
group by session_id, siswa_id
having count(*) > 1
order by cnt desc, session_id, siswa_id;
