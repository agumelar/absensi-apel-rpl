alter table public.sapa_pagi_schedule
add column if not exists hari text;

update public.sapa_pagi_schedule
set hari = case extract(isodow from tanggal)
  when 1 then 'senin'
  when 2 then 'selasa'
  when 3 then 'rabu'
  when 4 then 'kamis'
  when 5 then 'jumat'
  when 6 then 'sabtu'
  when 7 then 'minggu'
end
where hari is null
  and tanggal is not null;

update public.sapa_pagi_schedule
set hari = 'senin'
where hari is null;

alter table public.sapa_pagi_schedule
alter column hari set not null;

alter table public.sapa_pagi_schedule
drop constraint if exists sapa_pagi_schedule_hari_check;

alter table public.sapa_pagi_schedule
add constraint sapa_pagi_schedule_hari_check
check (hari in ('senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu', 'minggu'));

drop index if exists idx_sapa_pagi_schedule_tanggal;
create index if not exists idx_sapa_pagi_schedule_hari on public.sapa_pagi_schedule (hari);

alter table public.sapa_pagi_schedule
drop constraint if exists sapa_pagi_schedule_unique;

alter table public.sapa_pagi_schedule
add constraint sapa_pagi_schedule_unique unique (hari, user_id);
