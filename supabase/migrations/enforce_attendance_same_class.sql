-- Enforce data integrity:
-- student_attendance_mapel.siswa_id must belong to same class
-- as session.schedule_id -> schedule.kelas_id.

create or replace function public.validate_student_attendance_same_class()
returns trigger
language plpgsql
as $$
declare
  session_kelas_id bigint;
  siswa_kelas_id bigint;
begin
  select sc.kelas_id
  into session_kelas_id
  from public.session se
  join public.schedule sc on sc.id = se.schedule_id
  where se.id = new.session_id;

  if session_kelas_id is null then
    raise exception 'Session % tidak valid atau tidak memiliki kelas.', new.session_id;
  end if;

  select s.kelas_id
  into siswa_kelas_id
  from public.siswa s
  where s.id = new.siswa_id;

  if siswa_kelas_id is null then
    raise exception 'Siswa % tidak valid atau tidak memiliki kelas.', new.siswa_id;
  end if;

  if session_kelas_id <> siswa_kelas_id then
    raise exception
      'Siswa % (kelas %) tidak boleh diabsenkan pada session % (kelas %).',
      new.siswa_id,
      siswa_kelas_id,
      new.session_id,
      session_kelas_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validate_student_attendance_same_class on public.student_attendance_mapel;

create trigger trg_validate_student_attendance_same_class
before insert or update on public.student_attendance_mapel
for each row
execute function public.validate_student_attendance_same_class();
