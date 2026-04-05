create schema if not exists app;

create extension if not exists pg_cron;

alter table public.sapa_pagi_schedule
drop constraint if exists sapa_pagi_schedule_hari_check;

alter table public.sapa_pagi_schedule
add constraint sapa_pagi_schedule_hari_check
check (hari in ('senin', 'selasa', 'rabu', 'kamis', 'jumat'));

create or replace function app.is_business_weekday(p_date date default app.wib_today())
returns boolean
language sql
stable
as $$
  select extract(isodow from p_date) between 1 and 5;
$$;

create or replace function public.fn_submit_sapa_pagi(
  p_status text,
  p_note text,
  p_lat numeric,
  p_lng numeric,
  p_photo_path text,
  p_photo_size_kb integer,
  p_evidence_source text default 'rear_camera'
)
returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  actor_id uuid := app.current_user_id_uuid();
  actor_role text := app.current_role();
  actor_jurusan integer := app.current_jurusan_id();
  target_date date := app.wib_today();
  target_day text := app.wib_day_name(app.wib_today());
  now_time time := app.wib_now_time();
  settings_row public.pembiasaan_settings%rowtype;
  is_scheduled boolean;
  normalized_status text := lower(trim(coalesce(p_status, '')));
  normalized_note text := nullif(trim(coalesce(p_note, '')), '');
  distance_value numeric := null;
  is_within boolean := null;
  sanitized_photo_path text := null;
  sanitized_photo_size integer := null;
  sanitized_lat numeric := null;
  sanitized_lng numeric := null;
  sanitized_evidence_source text := null;
begin
  if actor_id is null then
    raise exception 'User tidak valid.';
  end if;

  if not app.is_business_weekday(target_date) then
    raise exception 'Pembiasaan hanya aktif pada hari Senin sampai Jumat.';
  end if;

  if normalized_status not in ('hadir', 'izin', 'sakit') then
    raise exception 'Status tidak valid untuk submit.';
  end if;

  perform app.assert_note_by_status(normalized_status, normalized_note);

  select * into settings_row from public.pembiasaan_settings where id = 1;
  if not found then
    raise exception 'Pengaturan pembiasaan belum tersedia.';
  end if;

  select exists(
    select 1
    from public.sapa_pagi_schedule s
    where s.hari = target_day
      and s.user_id = actor_id
      and s.is_active = true
  ) into is_scheduled;

  if not is_scheduled then
    raise exception 'Tidak ada jadwal sapa pagi untuk Anda.';
  end if;

  if now_time > settings_row.cutoff_sapa_pagi then
    raise exception 'Waktu submit sapa pagi sudah melewati cutoff.';
  end if;

  if normalized_status = 'hadir' then
    if p_lat is null or p_lng is null then
      raise exception 'GPS wajib aktif untuk status hadir.';
    end if;

    if nullif(trim(coalesce(p_photo_path, '')), '') is null then
      raise exception 'Foto bukti wajib diisi untuk status hadir.';
    end if;

    distance_value := app.distance_meters(settings_row.school_lat, settings_row.school_lng, p_lat, p_lng);
    is_within := distance_value <= settings_row.radius_meter;
    if not is_within then
      raise exception 'Lokasi di luar radius sekolah (% meter).', settings_row.radius_meter;
    end if;

    sanitized_photo_path := trim(p_photo_path);
    sanitized_photo_size := p_photo_size_kb;
    sanitized_lat := p_lat;
    sanitized_lng := p_lng;
    sanitized_evidence_source := coalesce(nullif(trim(coalesce(p_evidence_source, '')), ''), 'rear_camera');
  end if;

  insert into public.pembiasaan_attendance (
    tanggal,
    activity_type,
    user_id,
    role_snapshot,
    jurusan_id_snapshot,
    status,
    checkin_at,
    note,
    photo_path,
    photo_size_kb,
    lat,
    lng,
    distance_meter,
    is_within_radius,
    evidence_source,
    created_by_system,
    updated_at
  ) values (
    target_date,
    'sapa_pagi',
    actor_id,
    actor_role,
    actor_jurusan,
    normalized_status,
    app.wib_now_timestamp(),
    normalized_note,
    sanitized_photo_path,
    sanitized_photo_size,
    sanitized_lat,
    sanitized_lng,
    distance_value,
    is_within,
    sanitized_evidence_source,
    false,
    timezone('utc', now())
  )
  on conflict (tanggal, activity_type, user_id)
  do update set
    status = excluded.status,
    checkin_at = excluded.checkin_at,
    note = excluded.note,
    photo_path = excluded.photo_path,
    photo_size_kb = excluded.photo_size_kb,
    lat = excluded.lat,
    lng = excluded.lng,
    distance_meter = excluded.distance_meter,
    is_within_radius = excluded.is_within_radius,
    evidence_source = excluded.evidence_source,
    created_by_system = false,
    updated_at = timezone('utc', now())
  where public.pembiasaan_attendance.created_by_system = false;

  return jsonb_build_object(
    'success', true,
    'activity', 'sapa_pagi',
    'tanggal', target_date,
    'status', normalized_status,
    'distance_meter', distance_value,
    'is_within_radius', is_within
  );
end;
$$;

create or replace function public.fn_submit_pembiasaan(
  p_status text,
  p_note text,
  p_lat numeric,
  p_lng numeric,
  p_photo_path text,
  p_photo_size_kb integer,
  p_evidence_source text default 'rear_camera'
)
returns jsonb
language plpgsql
security definer
set search_path = public, app
as $$
declare
  actor_id uuid := app.current_user_id_uuid();
  actor_role text := app.current_role();
  actor_jurusan integer := app.current_jurusan_id();
  target_date date := app.wib_today();
  now_time time := app.wib_now_time();
  settings_row public.pembiasaan_settings%rowtype;
  normalized_status text := lower(trim(coalesce(p_status, '')));
  normalized_note text := nullif(trim(coalesce(p_note, '')), '');
  distance_value numeric := null;
  is_within boolean := null;
  sanitized_photo_path text := null;
  sanitized_photo_size integer := null;
  sanitized_lat numeric := null;
  sanitized_lng numeric := null;
  sanitized_evidence_source text := null;
begin
  if actor_id is null then
    raise exception 'User tidak valid.';
  end if;

  if not app.is_business_weekday(target_date) then
    raise exception 'Pembiasaan hanya aktif pada hari Senin sampai Jumat.';
  end if;

  if normalized_status not in ('hadir', 'izin', 'sakit') then
    raise exception 'Status tidak valid untuk submit.';
  end if;

  perform app.assert_note_by_status(normalized_status, normalized_note);

  select * into settings_row from public.pembiasaan_settings where id = 1;
  if not found then
    raise exception 'Pengaturan pembiasaan belum tersedia.';
  end if;

  if now_time > settings_row.cutoff_pembiasaan then
    raise exception 'Waktu submit pembiasaan sudah melewati cutoff.';
  end if;

  if normalized_status = 'hadir' then
    if p_lat is null or p_lng is null then
      raise exception 'GPS wajib aktif untuk status hadir.';
    end if;

    if nullif(trim(coalesce(p_photo_path, '')), '') is null then
      raise exception 'Foto bukti wajib diisi untuk status hadir.';
    end if;

    distance_value := app.distance_meters(settings_row.school_lat, settings_row.school_lng, p_lat, p_lng);
    if distance_value > settings_row.radius_meter then
      raise exception 'Lokasi di luar radius sekolah (% meter).', settings_row.radius_meter;
    end if;

    is_within := true;
    sanitized_photo_path := trim(p_photo_path);
    sanitized_photo_size := p_photo_size_kb;
    sanitized_lat := p_lat;
    sanitized_lng := p_lng;
    sanitized_evidence_source := coalesce(nullif(trim(coalesce(p_evidence_source, '')), ''), 'rear_camera');
  end if;

  insert into public.pembiasaan_attendance (
    tanggal,
    activity_type,
    user_id,
    role_snapshot,
    jurusan_id_snapshot,
    status,
    checkin_at,
    note,
    photo_path,
    photo_size_kb,
    lat,
    lng,
    distance_meter,
    is_within_radius,
    evidence_source,
    created_by_system,
    updated_at
  ) values (
    target_date,
    'pembiasaan',
    actor_id,
    actor_role,
    actor_jurusan,
    normalized_status,
    app.wib_now_timestamp(),
    normalized_note,
    sanitized_photo_path,
    sanitized_photo_size,
    sanitized_lat,
    sanitized_lng,
    distance_value,
    is_within,
    sanitized_evidence_source,
    false,
    timezone('utc', now())
  )
  on conflict (tanggal, activity_type, user_id)
  do update set
    status = excluded.status,
    checkin_at = excluded.checkin_at,
    note = excluded.note,
    photo_path = excluded.photo_path,
    photo_size_kb = excluded.photo_size_kb,
    lat = excluded.lat,
    lng = excluded.lng,
    distance_meter = excluded.distance_meter,
    is_within_radius = excluded.is_within_radius,
    evidence_source = excluded.evidence_source,
    created_by_system = false,
    updated_at = timezone('utc', now())
  where public.pembiasaan_attendance.created_by_system = false;

  return jsonb_build_object(
    'success', true,
    'activity', 'pembiasaan',
    'tanggal', target_date,
    'status', normalized_status,
    'distance_meter', distance_value,
    'is_within_radius', is_within
  );
end;
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

do $$
begin
  if exists (select 1 from cron.job where jobname = 'pembiasaan-finalize-alpha-sapa-weekday') then
    perform cron.unschedule('pembiasaan-finalize-alpha-sapa-weekday');
  end if;
exception
  when undefined_table then
    null;
end
$$;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'pembiasaan-finalize-alpha-pembiasaan-weekday') then
    perform cron.unschedule('pembiasaan-finalize-alpha-pembiasaan-weekday');
  end if;
exception
  when undefined_table then
    null;
end
$$;

select cron.schedule(
  'pembiasaan-finalize-alpha-sapa-weekday',
  '31 6 * * 1-5',
  $$select public.fn_finalize_auto_alpha((timezone('Asia/Jakarta', now()))::date);$$
)
where not exists (select 1 from cron.job where jobname = 'pembiasaan-finalize-alpha-sapa-weekday');

select cron.schedule(
  'pembiasaan-finalize-alpha-pembiasaan-weekday',
  '1 7 * * 1-5',
  $$select public.fn_finalize_auto_alpha((timezone('Asia/Jakarta', now()))::date);$$
)
where not exists (select 1 from cron.job where jobname = 'pembiasaan-finalize-alpha-pembiasaan-weekday');
