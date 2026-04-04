-- Hotfix: legacy schema still has NOT NULL on sapa_pagi_schedule.tanggal
-- New weekday-based scheduling uses kolom `hari`, so `tanggal` must be nullable.

alter table public.sapa_pagi_schedule
alter column tanggal drop not null;
