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

create or replace function app.current_user_id_int()
returns integer
language sql
stable
as $$
  select case
    when app.current_user_id_text() ~ '^[0-9]+$' then app.current_user_id_text()::integer
    else null
  end;
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

create or replace function app.claim_is_true(claim_key text)
returns boolean
language sql
stable
as $$
  select lower(coalesce(app.jwt_claim(claim_key), '')) in ('1', 'true', 't', 'yes', 'y');
$$;

create or replace function app.is_admin()
returns boolean
language sql
stable
as $$
  select app.current_role() = 'admin';
$$;

create or replace function app.is_kurikulum()
returns boolean
language sql
stable
as $$
  select app.current_role() in ('kepsek', 'kesiswaan', 'kaprog');
$$;

create or replace function app.is_picket()
returns boolean
language sql
stable
as $$
  select app.current_role() = 'piket';
$$;

create or replace function app.is_mapel_teacher()
returns boolean
language sql
stable
as $$
  select app.is_admin() or app.claim_is_true('is_guru_mapel');
$$;

do $$
declare
  schedule_teacher_col text;
  schedule_teacher_expr text;
begin
  if to_regclass('public.schedule') is null then
    return;
  end if;

  select c.column_name
  into schedule_teacher_col
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'schedule'
    and c.column_name in ('teacher_id', 'guru_id')
  order by case c.column_name when 'teacher_id' then 1 else 2 end
  limit 1;

  if schedule_teacher_col is null then
    return;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'schedule'
      and column_name = schedule_teacher_col
      and udt_name in ('int2', 'int4', 'int8')
  ) then
    schedule_teacher_expr := format('%I = app.current_user_id_int()', schedule_teacher_col);
  else
    schedule_teacher_expr := format('%I = app.current_user_id_uuid()', schedule_teacher_col);
  end if;

  execute 'alter table public.schedule enable row level security';

  execute 'drop policy if exists schedule_select_policy on public.schedule';
  execute format(
    'create policy schedule_select_policy on public.schedule for select using (
      app.is_admin()
      or app.is_kurikulum()
      or app.is_picket()
      or (app.is_mapel_teacher() and (%s))
    )',
    schedule_teacher_expr
  );

  execute 'drop policy if exists schedule_write_policy on public.schedule';
  execute format(
    'create policy schedule_write_policy on public.schedule for all using (
      app.is_admin()
      or (app.is_mapel_teacher() and (%s))
    ) with check (
      app.is_admin()
      or (app.is_mapel_teacher() and (%s))
    )',
    schedule_teacher_expr,
    schedule_teacher_expr
  );
end;
$$;

do $$
declare
  schedule_teacher_col text;
  schedule_teacher_expr text;
  session_teacher_col text;
  session_owner_expr text;
begin
  if to_regclass('public.session') is null or to_regclass('public.schedule') is null then
    return;
  end if;

  select c.column_name
  into schedule_teacher_col
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'schedule'
    and c.column_name in ('teacher_id', 'guru_id')
  order by case c.column_name when 'teacher_id' then 1 else 2 end
  limit 1;

  if schedule_teacher_col is null then
    return;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'schedule'
      and column_name = schedule_teacher_col
      and udt_name in ('int2', 'int4', 'int8')
  ) then
    schedule_teacher_expr := format('sch.%I = app.current_user_id_int()', schedule_teacher_col);
  else
    schedule_teacher_expr := format('sch.%I = app.current_user_id_uuid()', schedule_teacher_col);
  end if;

  select c.column_name
  into session_teacher_col
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'session'
    and c.column_name in ('teacher_id', 'guru_id')
  order by case c.column_name when 'teacher_id' then 1 else 2 end
  limit 1;

  session_owner_expr := format(
    'exists (select 1 from public.schedule sch where sch.id = public.session.schedule_id and %s)',
    schedule_teacher_expr
  );

  if session_teacher_col is not null then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'session'
        and column_name = session_teacher_col
        and udt_name in ('int2', 'int4', 'int8')
    ) then
      session_owner_expr := format(
        '(%s or public.session.%I = app.current_user_id_int())',
        session_owner_expr,
        session_teacher_col
      );
    else
      session_owner_expr := format(
        '(%s or public.session.%I = app.current_user_id_uuid())',
        session_owner_expr,
        session_teacher_col
      );
    end if;
  end if;

  execute 'alter table public.session enable row level security';

  execute 'drop policy if exists session_select_policy on public.session';
  execute format(
    'create policy session_select_policy on public.session for select using (
      app.is_admin()
      or app.is_kurikulum()
      or app.is_picket()
      or (app.is_mapel_teacher() and %s)
    )',
    session_owner_expr
  );

  execute 'drop policy if exists session_write_policy on public.session';
  execute format(
    'create policy session_write_policy on public.session for all using (
      app.is_admin()
      or (app.is_mapel_teacher() and %s)
    ) with check (
      app.is_admin()
      or (app.is_mapel_teacher() and %s)
    )',
    session_owner_expr,
    session_owner_expr
  );
end;
$$;

do $$
declare
  schedule_teacher_col text;
  session_teacher_col text;
  schedule_teacher_expr text;
  session_teacher_expr text;
  owner_expr text;
  owner_by_fk_expr text;
  table_name text;
  fk_col text;
begin
  if to_regclass('public.session') is null or to_regclass('public.schedule') is null then
    return;
  end if;

  select c.column_name
  into schedule_teacher_col
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'schedule'
    and c.column_name in ('teacher_id', 'guru_id')
  order by case c.column_name when 'teacher_id' then 1 else 2 end
  limit 1;

  if schedule_teacher_col is null then
    return;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'schedule'
      and column_name = schedule_teacher_col
      and udt_name in ('int2', 'int4', 'int8')
  ) then
    schedule_teacher_expr := format('sch.%I = app.current_user_id_int()', schedule_teacher_col);
  else
    schedule_teacher_expr := format('sch.%I = app.current_user_id_uuid()', schedule_teacher_col);
  end if;

  select c.column_name
  into session_teacher_col
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'session'
    and c.column_name in ('teacher_id', 'guru_id')
  order by case c.column_name when 'teacher_id' then 1 else 2 end
  limit 1;

  if session_teacher_col is not null then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'session'
        and column_name = session_teacher_col
        and udt_name in ('int2', 'int4', 'int8')
    ) then
      session_teacher_expr := format('s.%I = app.current_user_id_int()', session_teacher_col);
    else
      session_teacher_expr := format('s.%I = app.current_user_id_uuid()', session_teacher_col);
    end if;
  end if;

  owner_expr := schedule_teacher_expr;
  if session_teacher_expr is not null then
    owner_expr := format('(%s or %s)', schedule_teacher_expr, session_teacher_expr);
  end if;

  for table_name, fk_col in
    select 'class_agenda', 'session_id'
    union all
    select 'student_attendance_mapel', 'session_id'
    union all
    select 'daily_score', 'session_id'
    union all
    select 'teacher_absence_task', 'session_id'
  loop
    if to_regclass(format('public.%s', table_name)) is null then
      continue;
    end if;

    execute format('alter table public.%I enable row level security', table_name);

    owner_by_fk_expr := format(
      'exists (
        select 1
        from public.session s
        join public.schedule sch on sch.id = s.schedule_id
        where s.id = public.%I.%I
          and (%s)
      )',
      table_name,
      fk_col,
      owner_expr
    );

    execute format('drop policy if exists %I_select_policy on public.%I', table_name, table_name);
    execute format(
      'create policy %I_select_policy on public.%I for select using (
        app.is_admin()
        or app.is_kurikulum()
        or app.is_picket()
        or (app.is_mapel_teacher() and %s)
      )',
      table_name,
      table_name,
      owner_by_fk_expr
    );

    execute format('drop policy if exists %I_write_policy on public.%I', table_name, table_name);
    execute format(
      'create policy %I_write_policy on public.%I for all using (
        app.is_admin() or (
          app.is_mapel_teacher() and %s
        )
      ) with check (
        app.is_admin() or (
          app.is_mapel_teacher() and %s
        )
      )',
      table_name,
      table_name,
      owner_by_fk_expr,
      owner_by_fk_expr
    );
  end loop;
end;
$$;

do $$
begin
  if to_regclass('public.master_mapel') is null then
    return;
  end if;

  execute 'alter table public.master_mapel enable row level security';
  execute 'drop policy if exists master_mapel_select_policy on public.master_mapel';
  execute 'create policy master_mapel_select_policy on public.master_mapel for select using (
    app.is_admin() or app.is_kurikulum() or app.is_picket() or app.is_mapel_teacher()
  )';
  execute 'drop policy if exists master_mapel_write_policy on public.master_mapel';
  execute 'create policy master_mapel_write_policy on public.master_mapel for all using (
    app.is_admin() or app.is_kurikulum()
  ) with check (
    app.is_admin() or app.is_kurikulum()
  )';
end;
$$;

do $$
begin
  if to_regclass('public.mapel_audit_log') is null then
    return;
  end if;

  execute 'alter table public.mapel_audit_log enable row level security';
  execute 'drop policy if exists mapel_audit_log_select_policy on public.mapel_audit_log';
  execute 'create policy mapel_audit_log_select_policy on public.mapel_audit_log for select using (
    app.is_admin()
    or app.is_kurikulum()
    or app.is_picket()
    or (app.is_mapel_teacher() and actor_id = app.current_user_id_text())
  )';

  execute 'drop policy if exists mapel_audit_log_insert_policy on public.mapel_audit_log';
  execute 'create policy mapel_audit_log_insert_policy on public.mapel_audit_log for insert with check (
    app.is_admin()
    or (app.is_mapel_teacher() and actor_id = app.current_user_id_text())
  )';
end;
$$;
