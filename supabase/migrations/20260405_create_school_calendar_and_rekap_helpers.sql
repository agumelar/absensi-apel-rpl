create schema if not exists app;

create table if not exists public.school_calendar (
  id uuid primary key default uuid_generate_v4(),
  tanggal date not null unique,
  is_libur boolean not null default true,
  keterangan text,
  updated_by uuid,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint school_calendar_updated_by_fkey foreign key (updated_by) references public.walikelas(id)
);

create index if not exists idx_school_calendar_tanggal on public.school_calendar (tanggal);

create or replace function public.fn_is_school_active_day(p_date date)
returns boolean
language sql
stable
as $$
  select
    (extract(isodow from p_date) between 1 and 5)
    and not exists (
      select 1
      from public.school_calendar sc
      where sc.tanggal = p_date
        and sc.is_libur = true
    );
$$;

create or replace function public.fn_count_school_active_days(
  p_from date,
  p_to date
)
returns integer
language sql
stable
as $$
  with dates as (
    select generate_series(p_from, p_to, interval '1 day')::date as dt
  )
  select count(*)::integer
  from dates
  where public.fn_is_school_active_day(dt);
$$;

create or replace function public.fn_finalize_auto_alpha(p_tanggal date default app.wib_today())
returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  target_date date := coalesce(p_tanggal, app.wib_today());
  target_day text := app.wib_day_name(coalesce(p_tanggal, app.wib_today()));
  now_wib_date date := app.wib_today();
  now_wib_time time := app.wib_now_time();
  settings_row public.pembiasaan_settings%rowtype;
  inserted_sapa integer := 0;
  inserted_pembiasaan integer := 0;
begin
  select * into settings_row from public.pembiasaan_settings where id = 1;
  if not found then
    raise exception 'Pengaturan pembiasaan belum tersedia.';
  end if;

  if not public.fn_is_school_active_day(target_date) then
    return jsonb_build_object(
      'success', true,
      'tanggal', target_date,
      'inserted_sapa_pagi_alpha', 0,
      'inserted_pembiasaan_alpha', 0
    );
  end if;

  if target_day in ('sabtu', 'minggu') then
    return jsonb_build_object(
      'success', true,
      'tanggal', target_date,
      'inserted_sapa_pagi_alpha', 0,
      'inserted_pembiasaan_alpha', 0
    );
  end if;

  if target_date > now_wib_date then
    return jsonb_build_object(
      'success', true,
      'tanggal', target_date,
      'inserted_sapa_pagi_alpha', 0,
      'inserted_pembiasaan_alpha', 0
    );
  end if;

  if target_date < now_wib_date or now_wib_time > settings_row.cutoff_sapa_pagi then
    insert into public.pembiasaan_attendance (
      tanggal, activity_type, user_id, role_snapshot, jurusan_id_snapshot, status, created_by_system, updated_at
    )
    select
      target_date,
      'sapa_pagi',
      sch.user_id,
      lower(coalesce(w.role, 'guru')),
      w.jurusan_id,
      'alpha',
      true,
      timezone('utc', now())
    from public.sapa_pagi_schedule sch
    join public.walikelas w on w.id = sch.user_id
    where sch.hari = target_day
      and sch.is_active = true
      and not exists (
        select 1
        from public.pembiasaan_attendance pa
        where pa.tanggal = target_date
          and pa.activity_type = 'sapa_pagi'
          and pa.user_id = sch.user_id
      );

    get diagnostics inserted_sapa = row_count;
  end if;

  if target_date < now_wib_date or now_wib_time > settings_row.cutoff_pembiasaan then
    insert into public.pembiasaan_attendance (
      tanggal, activity_type, user_id, role_snapshot, jurusan_id_snapshot, status, created_by_system, updated_at
    )
    select
      target_date,
      'pembiasaan',
      w.id,
      lower(coalesce(w.role, 'guru')),
      w.jurusan_id,
      'alpha',
      true,
      timezone('utc', now())
    from public.walikelas w
    where lower(coalesce(w.role, '')) in ('guru', 'tu', 'kepsek', 'kesiswaan', 'kaprog', 'kurikulum', 'piket', 'admin', 'walikelas', 'walas')
      and not exists (
        select 1
        from public.pembiasaan_attendance pa
        where pa.tanggal = target_date
          and pa.activity_type = 'pembiasaan'
          and pa.user_id = w.id
      );

    get diagnostics inserted_pembiasaan = row_count;
  end if;

  return jsonb_build_object(
    'success', true,
    'tanggal', target_date,
    'inserted_sapa_pagi_alpha', inserted_sapa,
    'inserted_pembiasaan_alpha', inserted_pembiasaan
  );
end;
$$;
