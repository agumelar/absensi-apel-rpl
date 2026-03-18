create table if not exists public.mapel_audit_log (
  id bigint generated always as identity primary key,
  session_id text not null,
  actor_id text not null,
  actor_name text,
  actor_role text not null,
  action_type text not null check (
    action_type in (
      'agenda_submit',
      'session_check_in',
      'session_check_out',
      'attendance_manual_save',
      'task_delivered_by_picket'
    )
  ),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists mapel_audit_log_session_created_idx
  on public.mapel_audit_log (session_id, created_at desc);

create index if not exists mapel_audit_log_actor_created_idx
  on public.mapel_audit_log (actor_id, created_at desc);

create index if not exists mapel_audit_log_action_created_idx
  on public.mapel_audit_log (action_type, created_at desc);
