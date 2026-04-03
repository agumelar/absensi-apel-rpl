-- Fix ON CONFLICT failures on mapel upsert flows.
-- Root cause: missing unique arbiter on (session_id, siswa_id)
-- for public.daily_score and public.student_attendance_mapel.

-- 1) Deduplicate existing rows by keeping the newest row
--    (created_at DESC, fallback id DESC) per session+siswa pair.
with ranked_daily_score as (
  select
    id,
    row_number() over (
      partition by session_id, siswa_id
      order by created_at desc nulls last, id desc
    ) as rn
  from public.daily_score
)
delete from public.daily_score target
using ranked_daily_score ranked
where target.id = ranked.id
  and ranked.rn > 1;

with ranked_student_attendance as (
  select
    id,
    row_number() over (
      partition by session_id, siswa_id
      order by created_at desc nulls last, id desc
    ) as rn
  from public.student_attendance_mapel
)
delete from public.student_attendance_mapel target
using ranked_student_attendance ranked
where target.id = ranked.id
  and ranked.rn > 1;

-- 2) Create unique arbiters used by upsert onConflict: 'session_id,siswa_id'.
create unique index if not exists daily_score_session_siswa_uidx
  on public.daily_score (session_id, siswa_id);

create unique index if not exists student_attendance_mapel_session_siswa_uidx
  on public.student_attendance_mapel (session_id, siswa_id);
