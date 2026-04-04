create schema if not exists app;

create or replace function app.jwt_claim(claim_key text)
returns text
language plpgsql
stable
as $$
declare
  claims_json jsonb;
begin
  begin
    claims_json := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  exception
    when others then
      claims_json := null;
  end;

  if claims_json is null then
    return null;
  end if;

  return nullif(claims_json ->> claim_key, '');
end;
$$;

create or replace function app.current_role()
returns text
language sql
stable
as $$
  select lower(coalesce(app.jwt_claim('role'), app.jwt_claim('app_role'), ''));
$$;

create or replace function app.current_user_id_text()
returns text
language sql
stable
as $$
  select coalesce(
    app.jwt_claim('walikelas_id'),
    app.jwt_claim('user_id'),
    app.jwt_claim('sub'),
    ''
  );
$$;

create or replace function app.current_user_id_uuid()
returns uuid
language sql
stable
as $$
  select case
    when app.current_user_id_text() ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then app.current_user_id_text()::uuid
    else null
  end;
$$;

create or replace function app.is_admin()
returns boolean
language sql
stable
as $$
  select app.current_role() = 'admin';
$$;

create table if not exists public.pembiasaan_settings (
  id integer primary key default 1,
  school_name text not null default 'SMK',
  school_lat numeric(10, 7) not null,
  school_lng numeric(10, 7) not null,
  radius_meter integer not null default 200,
  cutoff_sapa_pagi time not null default '06:30:00',
  cutoff_pembiasaan time not null default '07:00:00',
  photo_retention_days integer not null default 30,
  updated_by uuid,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint pembiasaan_settings_singleton check (id = 1),
  constraint pembiasaan_settings_radius_positive check (radius_meter > 0),
  constraint pembiasaan_settings_retention_positive check (photo_retention_days > 0),
  constraint pembiasaan_settings_updated_by_fkey foreign key (updated_by) references public.walikelas(id)
);

insert into public.pembiasaan_settings (id, school_name, school_lat, school_lng)
values (1, 'SMK', -6.2000000, 106.8166660)
on conflict (id) do nothing;

create table if not exists public.sapa_pagi_schedule (
  id uuid primary key default uuid_generate_v4(),
  hari text not null,
  tanggal date,
  user_id uuid not null,
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint sapa_pagi_schedule_hari_check check (hari in ('senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu')),
  constraint sapa_pagi_schedule_user_fkey foreign key (user_id) references public.walikelas(id),
  constraint sapa_pagi_schedule_created_by_fkey foreign key (created_by) references public.walikelas(id),
  constraint sapa_pagi_schedule_unique unique (hari, user_id)
);

create index if not exists idx_sapa_pagi_schedule_hari on public.sapa_pagi_schedule (hari);
create index if not exists idx_sapa_pagi_schedule_user on public.sapa_pagi_schedule (user_id);

create table if not exists public.pembiasaan_attendance (
  id uuid primary key default uuid_generate_v4(),
  tanggal date not null,
  activity_type text not null,
  user_id uuid not null,
  role_snapshot text not null,
  jurusan_id_snapshot integer,
  status text not null,
  checkin_at timestamptz,
  note text,
  photo_path text,
  photo_size_kb integer,
  lat numeric(10, 7),
  lng numeric(10, 7),
  distance_meter numeric(10, 2),
  is_within_radius boolean,
  evidence_source text,
  created_by_system boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint pembiasaan_attendance_unique unique (tanggal, activity_type, user_id),
  constraint pembiasaan_attendance_activity_check check (activity_type in ('sapa_pagi', 'pembiasaan')),
  constraint pembiasaan_attendance_status_check check (status in ('hadir', 'izin', 'sakit', 'alpha')),
  constraint pembiasaan_attendance_photo_size_non_negative check (photo_size_kb is null or photo_size_kb >= 0),
  constraint pembiasaan_attendance_distance_non_negative check (distance_meter is null or distance_meter >= 0),
  constraint pembiasaan_attendance_user_fkey foreign key (user_id) references public.walikelas(id),
  constraint pembiasaan_attendance_jurusan_fkey foreign key (jurusan_id_snapshot) references public.master_jurusan(id)
);

create index if not exists idx_pembiasaan_attendance_tanggal on public.pembiasaan_attendance (tanggal);
create index if not exists idx_pembiasaan_attendance_activity on public.pembiasaan_attendance (activity_type);
create index if not exists idx_pembiasaan_attendance_user on public.pembiasaan_attendance (user_id);
create index if not exists idx_pembiasaan_attendance_status on public.pembiasaan_attendance (status);
create index if not exists idx_pembiasaan_attendance_jurusan on public.pembiasaan_attendance (jurusan_id_snapshot);

create or replace function app.current_jurusan_id()
returns integer
language plpgsql
stable
as $$
declare
  jurusan_claim text;
  jurusan_value integer;
begin
  jurusan_claim := app.jwt_claim('jurusan_id');
  if coalesce(jurusan_claim, '') ~ '^[0-9]+$' then
    return jurusan_claim::integer;
  end if;

  select w.jurusan_id
  into jurusan_value
  from public.walikelas w
  where w.id = app.current_user_id_uuid();

  return jurusan_value;
end;
$$;

create or replace function app.is_executive()
returns boolean
language sql
stable
as $$
  select app.current_role() in ('kepsek', 'kesiswaan', 'kaprog', 'kurikulum');
$$;

create or replace function app.can_view_jurusan(target_jurusan integer)
returns boolean
language sql
stable
as $$
  select
    app.is_admin()
    or app.current_role() in ('kepsek', 'kesiswaan', 'kurikulum')
    or (
      app.current_role() = 'kaprog'
      and app.current_jurusan_id() is not null
      and app.current_jurusan_id() = target_jurusan
    );
$$;

create or replace function app.distance_meters(
  lat1 numeric,
  lng1 numeric,
  lat2 numeric,
  lng2 numeric
)
returns numeric
language sql
immutable
as $$
  select
    round(
      (
        6371000 * 2 * asin(
          sqrt(
            power(sin(radians((lat2 - lat1)::double precision) / 2), 2)
            + cos(radians(lat1::double precision))
            * cos(radians(lat2::double precision))
            * power(sin(radians((lng2 - lng1)::double precision) / 2), 2)
          )
        )
      )::numeric,
      2
    );
$$;
