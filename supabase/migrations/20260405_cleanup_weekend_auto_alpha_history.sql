-- Cleanup historical weekend auto-alpha rows created before weekday-only policy.
-- Safe to run multiple times (idempotent): second run deletes 0 rows.

begin;

delete from public.pembiasaan_attendance
where created_by_system = true
  and status = 'alpha'
  and extract(isodow from tanggal) in (6, 7);

commit;
