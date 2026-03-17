create table if not exists public.schedule (
  id bigint generated always as identity primary key,
  teacher_id integer not null references public.walikelas (id) on delete cascade,
  kelas_id integer not null references public.master_kelas (id) on delete restrict,
  subject_name text not null,
  day_of_week smallint not null check (day_of_week between 1 and 7),
  start_time time not null,
  end_time time not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint schedule_time_valid check (end_time > start_time)
);

create unique index if not exists schedule_teacher_slot_unique
  on public.schedule (teacher_id, day_of_week, start_time, end_time);

create table if not exists public.session (
  id bigint generated always as identity primary key,
  schedule_id bigint not null references public.schedule (id) on delete cascade,
  teacher_id integer not null references public.walikelas (id) on delete restrict,
  kelas_id integer not null references public.master_kelas (id) on delete restrict,
  session_date date not null,
  status text not null default 'scheduled' check (
    status in ('scheduled', 'checked_in', 'teaching', 'checked_out', 'completed', 'absent')
  ),
  check_in_at timestamptz,
  check_out_at timestamptz,
  check_in_photo_url text,
  check_out_photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint session_teacher_date_unique unique (schedule_id, session_date)
);

create index if not exists session_status_idx on public.session (status);
create index if not exists session_date_idx on public.session (session_date);
create index if not exists session_teacher_idx on public.session (teacher_id, session_date);

create table if not exists public.class_agenda (
  id bigint generated always as identity primary key,
  session_id bigint not null unique references public.session (id) on delete cascade,
  topic text not null,
  method text not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.student_attendance_mapel (
  id bigint generated always as identity primary key,
  session_id bigint not null references public.session (id) on delete cascade,
  siswa_id integer not null references public.siswa (id) on delete restrict,
  status text not null check (status in ('H', 'S', 'I', 'A')),
  note text,
  recorded_at timestamptz not null default now(),
  constraint student_attendance_mapel_unique unique (session_id, siswa_id)
);

create index if not exists student_attendance_mapel_status_idx
  on public.student_attendance_mapel (session_id, status);

create table if not exists public.teacher_absence_task (
  id bigint generated always as identity primary key,
  session_id bigint not null unique references public.session (id) on delete cascade,
  teacher_id integer not null references public.walikelas (id) on delete restrict,
  task_title text not null,
  task_description text not null,
  attachment_url text,
  delivered_by_picket boolean not null default false,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists teacher_absence_task_delivery_idx
  on public.teacher_absence_task (delivered_by_picket, delivered_at);

create table if not exists public.daily_score (
  id bigint generated always as identity primary key,
  session_id bigint not null references public.session (id) on delete cascade,
  siswa_id integer not null references public.siswa (id) on delete restrict,
  score numeric(5,2) check (score >= 0 and score <= 100),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_score_unique unique (session_id, siswa_id)
);

create index if not exists daily_score_session_idx on public.daily_score (session_id);
