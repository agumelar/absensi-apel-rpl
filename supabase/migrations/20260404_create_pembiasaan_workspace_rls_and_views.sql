alter table public.pembiasaan_settings enable row level security;
alter table public.sapa_pagi_schedule enable row level security;
alter table public.pembiasaan_attendance enable row level security;

drop policy if exists pembiasaan_settings_read_policy on public.pembiasaan_settings;
create policy pembiasaan_settings_read_policy
on public.pembiasaan_settings
for select
using (
  app.is_admin() or app.is_executive() or app.current_role() in ('guru', 'tu', 'walikelas', 'walas', 'piket')
);

drop policy if exists pembiasaan_settings_write_policy on public.pembiasaan_settings;
create policy pembiasaan_settings_write_policy
on public.pembiasaan_settings
for all
using (app.is_admin())
with check (app.is_admin());

drop policy if exists sapa_pagi_schedule_read_policy on public.sapa_pagi_schedule;
create policy sapa_pagi_schedule_read_policy
on public.sapa_pagi_schedule
for select
using (
  app.is_admin()
  or app.is_executive()
  or user_id = app.current_user_id_uuid()
);

drop policy if exists sapa_pagi_schedule_write_policy on public.sapa_pagi_schedule;
create policy sapa_pagi_schedule_write_policy
on public.sapa_pagi_schedule
for all
using (app.is_admin())
with check (app.is_admin());

drop policy if exists pembiasaan_attendance_read_policy on public.pembiasaan_attendance;
create policy pembiasaan_attendance_read_policy
on public.pembiasaan_attendance
for select
using (
  app.is_admin()
  or user_id = app.current_user_id_uuid()
  or (
    app.is_executive()
    and (
      app.current_role() in ('kepsek', 'kesiswaan', 'kurikulum')
      or (
        app.current_role() = 'kaprog'
        and app.current_jurusan_id() is not null
        and jurusan_id_snapshot = app.current_jurusan_id()
      )
    )
  )
);

drop policy if exists pembiasaan_attendance_write_policy on public.pembiasaan_attendance;
create policy pembiasaan_attendance_write_policy
on public.pembiasaan_attendance
for all
using (app.is_admin() or user_id = app.current_user_id_uuid())
with check (app.is_admin() or user_id = app.current_user_id_uuid());

create or replace view public.vw_laporan_pembiasaan_ringkas_harian as
select
  pa.tanggal,
  pa.activity_type,
  count(*)::integer as total_peserta,
  count(*) filter (where pa.status = 'hadir')::integer as total_hadir,
  count(*) filter (where pa.status = 'izin')::integer as total_izin,
  count(*) filter (where pa.status = 'sakit')::integer as total_sakit,
  count(*) filter (where pa.status = 'alpha')::integer as total_alpha,
  round((count(*) filter (where pa.status = 'hadir')::numeric / nullif(count(*), 0)) * 100, 1) as hadir_rate
from public.pembiasaan_attendance pa
group by pa.tanggal, pa.activity_type;

create or replace view public.vw_rekap_sapa_pagi_per_user as
select
  pa.tanggal,
  pa.user_id,
  w.nama_lengkap,
  w.role,
  w.jurusan_id,
  count(*) filter (where pa.activity_type = 'sapa_pagi')::integer as total_terjadwal,
  count(*) filter (where pa.activity_type = 'sapa_pagi' and pa.status = 'hadir')::integer as total_hadir,
  count(*) filter (where pa.activity_type = 'sapa_pagi' and pa.status = 'izin')::integer as total_izin,
  count(*) filter (where pa.activity_type = 'sapa_pagi' and pa.status = 'sakit')::integer as total_sakit,
  count(*) filter (where pa.activity_type = 'sapa_pagi' and pa.status = 'alpha')::integer as total_alpha
from public.pembiasaan_attendance pa
join public.walikelas w on w.id = pa.user_id
where pa.activity_type = 'sapa_pagi'
group by pa.tanggal, pa.user_id, w.nama_lengkap, w.role, w.jurusan_id;

create or replace view public.vw_rekap_pembiasaan_per_user as
select
  pa.tanggal,
  pa.user_id,
  w.nama_lengkap,
  w.role,
  w.jurusan_id,
  count(*) filter (where pa.activity_type = 'pembiasaan')::integer as total_hari_aktif,
  count(*) filter (where pa.activity_type = 'pembiasaan' and pa.status = 'hadir')::integer as total_hadir,
  count(*) filter (where pa.activity_type = 'pembiasaan' and pa.status = 'izin')::integer as total_izin,
  count(*) filter (where pa.activity_type = 'pembiasaan' and pa.status = 'sakit')::integer as total_sakit,
  count(*) filter (where pa.activity_type = 'pembiasaan' and pa.status = 'alpha')::integer as total_alpha
from public.pembiasaan_attendance pa
join public.walikelas w on w.id = pa.user_id
where pa.activity_type = 'pembiasaan'
group by pa.tanggal, pa.user_id, w.nama_lengkap, w.role, w.jurusan_id;

create or replace view public.vw_riwayat_pembiasaan_detail as
select
  pa.id,
  pa.tanggal,
  pa.activity_type,
  pa.user_id,
  w.nama_lengkap,
  w.role,
  pa.jurusan_id_snapshot,
  j.nama_jurusan,
  pa.status,
  pa.checkin_at,
  pa.note,
  pa.photo_path,
  pa.photo_size_kb,
  pa.lat,
  pa.lng,
  pa.distance_meter,
  pa.is_within_radius,
  pa.evidence_source,
  pa.created_by_system,
  pa.created_at,
  pa.updated_at
from public.pembiasaan_attendance pa
join public.walikelas w on w.id = pa.user_id
left join public.master_jurusan j on j.id = pa.jurusan_id_snapshot;
