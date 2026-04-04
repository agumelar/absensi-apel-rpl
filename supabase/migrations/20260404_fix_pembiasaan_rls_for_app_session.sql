-- Hotfix for current app auth model (non-Supabase Auth session):
-- frontend uses local session, so JWT claims are not available to RLS.
-- Make pembiasaan tables writable/readable and keep role checks in app/service layer.

alter table public.pembiasaan_settings enable row level security;
alter table public.sapa_pagi_schedule enable row level security;
alter table public.pembiasaan_attendance enable row level security;

drop policy if exists pembiasaan_settings_read_policy on public.pembiasaan_settings;
drop policy if exists pembiasaan_settings_write_policy on public.pembiasaan_settings;
drop policy if exists sapa_pagi_schedule_read_policy on public.sapa_pagi_schedule;
drop policy if exists sapa_pagi_schedule_write_policy on public.sapa_pagi_schedule;
drop policy if exists pembiasaan_attendance_read_policy on public.pembiasaan_attendance;
drop policy if exists pembiasaan_attendance_write_policy on public.pembiasaan_attendance;

create policy pembiasaan_settings_public_rw
on public.pembiasaan_settings
for all
using (true)
with check (true);

create policy sapa_pagi_schedule_public_rw
on public.sapa_pagi_schedule
for all
using (true)
with check (true);

create policy pembiasaan_attendance_public_rw
on public.pembiasaan_attendance
for all
using (true)
with check (true);
