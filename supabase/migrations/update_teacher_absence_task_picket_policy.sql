do $$
declare
  schedule_teacher_col text;
  owner_expr text;
begin
  if to_regclass('public.teacher_absence_task') is null
     or to_regclass('public.session') is null
     or to_regclass('public.schedule') is null then
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

  owner_expr := format(
    'exists (
      select 1
      from public.session s
      join public.schedule sch on sch.id = s.schedule_id
      where s.id = public.teacher_absence_task.session_id
        and sch.%I::text = app.current_user_id_text()
    )',
    schedule_teacher_col
  );

  execute 'alter table public.teacher_absence_task enable row level security';
  execute 'drop policy if exists teacher_absence_task_write_policy on public.teacher_absence_task';
  execute format(
    'create policy teacher_absence_task_write_policy on public.teacher_absence_task
      for all
      using (
        app.is_admin()
        or app.is_picket()
        or (app.is_mapel_teacher() and %s)
      )
      with check (
        app.is_admin()
        or app.is_picket()
        or (app.is_mapel_teacher() and %s)
      )',
    owner_expr,
    owner_expr
  );
end;
$$;
