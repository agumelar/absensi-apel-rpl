-- Ensure deleting a class removes dependent student/class data,
-- while keeping homeroom teacher accounts by nulling their kelas_id.

-- 1) Class-level relations
alter table public.siswa
  drop constraint if exists siswa_kelas_id_fkey;
alter table public.siswa
  add constraint siswa_kelas_id_fkey
  foreign key (kelas_id) references public.master_kelas(id) on delete cascade;

alter table public.schedule
  drop constraint if exists schedule_kelas_id_fkey;
alter table public.schedule
  add constraint schedule_kelas_id_fkey
  foreign key (kelas_id) references public.master_kelas(id) on delete cascade;

alter table public.walikelas
  drop constraint if exists walikelas_kelas_id_fkey;
alter table public.walikelas
  add constraint walikelas_kelas_id_fkey
  foreign key (kelas_id) references public.master_kelas(id) on delete set null;

-- 2) Student dependency chain
alter table public.absensi
  drop constraint if exists absensi_siswa_id_fkey;
alter table public.absensi
  add constraint absensi_siswa_id_fkey
  foreign key (siswa_id) references public.siswa(id) on delete cascade;

alter table public.log_piket
  drop constraint if exists log_piket_siswa_id_fkey;
alter table public.log_piket
  add constraint log_piket_siswa_id_fkey
  foreign key (siswa_id) references public.siswa(id) on delete cascade;

alter table public.student_attendance_mapel
  drop constraint if exists student_attendance_mapel_siswa_id_fkey;
alter table public.student_attendance_mapel
  add constraint student_attendance_mapel_siswa_id_fkey
  foreign key (siswa_id) references public.siswa(id) on delete cascade;

alter table public.daily_score
  drop constraint if exists daily_score_siswa_id_fkey;
alter table public.daily_score
  add constraint daily_score_siswa_id_fkey
  foreign key (siswa_id) references public.siswa(id) on delete cascade;

-- 3) Schedule/session dependency chain
alter table public.session
  drop constraint if exists session_schedule_id_fkey;
alter table public.session
  add constraint session_schedule_id_fkey
  foreign key (schedule_id) references public.schedule(id) on delete cascade;

alter table public.class_agenda
  drop constraint if exists class_agenda_session_id_fkey;
alter table public.class_agenda
  add constraint class_agenda_session_id_fkey
  foreign key (session_id) references public.session(id) on delete cascade;

alter table public.student_attendance_mapel
  drop constraint if exists student_attendance_mapel_session_id_fkey;
alter table public.student_attendance_mapel
  add constraint student_attendance_mapel_session_id_fkey
  foreign key (session_id) references public.session(id) on delete cascade;

alter table public.teacher_absence_task
  drop constraint if exists teacher_absence_task_session_id_fkey;
alter table public.teacher_absence_task
  add constraint teacher_absence_task_session_id_fkey
  foreign key (session_id) references public.session(id) on delete cascade;

alter table public.daily_score
  drop constraint if exists daily_score_session_id_fkey;
alter table public.daily_score
  add constraint daily_score_session_id_fkey
  foreign key (session_id) references public.session(id) on delete cascade;
