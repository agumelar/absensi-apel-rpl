do $$
begin
  if to_regclass('public.mapel_audit_log') is null then
    return;
  end if;

  alter table public.mapel_audit_log
    drop constraint if exists mapel_audit_log_action_type_check;

  alter table public.mapel_audit_log
    add constraint mapel_audit_log_action_type_check
    check (
      action_type in (
        'agenda_submit',
        'session_check_in',
        'session_check_out',
        'attendance_manual_save',
        'task_delivered_by_picket'
      )
    );
end;
$$;
