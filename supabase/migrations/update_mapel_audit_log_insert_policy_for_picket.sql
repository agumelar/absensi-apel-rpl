do $$
begin
  if to_regclass('public.mapel_audit_log') is null then
    return;
  end if;

  execute 'alter table public.mapel_audit_log enable row level security';
  execute 'drop policy if exists mapel_audit_log_insert_policy on public.mapel_audit_log';
  execute 'create policy mapel_audit_log_insert_policy on public.mapel_audit_log for insert with check (
    app.is_admin()
    or app.is_picket()
    or (app.is_mapel_teacher() and actor_id = app.current_user_id_text())
  )';
end;
$$;
