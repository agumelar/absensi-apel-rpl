import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MAPEL_AUDIT_ROUTE,
  MAPEL_HISTORY_ROUTE,
  MAPEL_RECAP_ROUTE,
  MAPEL_SCORE_RECAP_ROUTE,
  MAPEL_SCHEDULE_ROUTE,
  MAPEL_SCORE_ROUTE,
  MAPEL_SESSION_ROUTE,
} from '../../../shared/constants/routes';
import { isMapelAuditRole, normalizeRole } from '../../../shared/constants/roles';
import { fetchSchedulesByGuruToday, fetchSessionsByTanggal } from '../../../services/mapelService';
import { getTodayDateWIB } from '../../../services/shared/dateService';
import Button from '../../../shared/ui/Button';
import Card, { CardContent } from '../../../shared/ui/Card';
import { PageContainer, PageHeader, PageSubtitle, PageTitle } from '../../../shared/ui/PageLayout';
import Swal from 'sweetalert2';

const EMPTY_SUMMARY = {
  jadwal: 0,
  sesi: 0,
  hadir: 0,
  tidakMasuk: 0,
  checkIn: 0,
  checkOut: 0,
  pendingMulai: 0,
  sesiAktif: 0,
};

const MapelHomePage = ({ user }) => {
  const [todaySummary, setTodaySummary] = useState(EMPTY_SUMMARY);
  const role = normalizeRole(user?.role);
  const canOpenAudit = isMapelAuditRole(role);
  const today = useMemo(() => getTodayDateWIB(), []);
  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('id-ID', {
        dateStyle: 'full',
        timeZone: 'Asia/Jakarta',
      }).format(new Date(`${today}T00:00:00+07:00`)),
    [today],
  );
  const usernameLabel = user?.nama_lengkap || user?.username || 'Guru';

  const completionPercent = useMemo(() => {
    if (todaySummary.jadwal === 0) return 0;
    return Math.min(100, Math.round((todaySummary.checkOut / todaySummary.jadwal) * 100));
  }, [todaySummary.checkOut, todaySummary.jadwal]);

  useEffect(() => {
    const loadSummary = async () => {
      if (!user?.id) return;
      const [schedules, sessions] = await Promise.all([fetchSchedulesByGuruToday(user.id, today), fetchSessionsByTanggal(today)]);
      const hadir = sessions.filter((item) => String(item.status || '').toLowerCase() === 'hadir').length;
      const checkIn = sessions.filter((item) => Boolean(item.waktu_check_in)).length;
      const checkOut = sessions.filter((item) => Boolean(item.waktu_check_out)).length;
      const tidakMasuk = sessions.filter((item) => {
        const status = String(item.status || '').toLowerCase();
        return status === 'tidak_masuk' || status === 'tidak masuk' || status === 'absent';
      }).length;
      setTodaySummary({
        jadwal: schedules.length,
        sesi: sessions.length,
        hadir,
        tidakMasuk,
        checkIn,
        checkOut,
        pendingMulai: Math.max(schedules.length - sessions.length, 0),
        sesiAktif: Math.max(checkIn - checkOut, 0),
      });
    };

    loadSummary().catch((error) => Swal.fire('Gagal', error.message, 'error'));
  }, [today, user?.id]);

  return (
    <PageContainer className="max-w-5xl space-y-5">
      <PageHeader className="mb-5 block space-y-2">
        <PageTitle className="text-2xl md:text-3xl">Modul Guru Mapel</PageTitle>
        <PageSubtitle>Workspace KBM Digital</PageSubtitle>
      </PageHeader>

      <Card className="rounded-3xl">
        <CardContent className="space-y-5 p-6 md:p-7">
          <div className="grid gap-4 md:grid-cols-2 md:items-center">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Ringkasan Hari Ini</p>
              <h2 className="text-xl font-black text-slate-900 md:text-2xl">Halo, {usernameLabel}</h2>
              <p className="text-sm text-slate-600">{todayLabel}</p>
              <p className="text-sm text-slate-600">
                Fokus utama: mulai sesi tepat waktu, lengkapi absensi, lalu tutup sesi agar data harian tetap rapi.
              </p>
              <Link to={MAPEL_SESSION_ROUTE}>
                <Button size="lg" className="mt-2">
                  Mulai / Lanjutkan Sesi Hari Ini
                </Button>
              </Link>
            </div>
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Progress Penutupan Sesi</p>
              <p className="mt-2 text-3xl font-black text-blue-700">{completionPercent}%</p>
              <p className="mt-1 text-xs text-slate-600">
                {todaySummary.checkOut} dari {todaySummary.jadwal} jadwal sudah check-out.
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/80">
                <div className="h-2 rounded-full bg-blue-600 transition-all duration-300" style={{ width: `${completionPercent}%` }} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-xs text-slate-500">Jadwal Hari Ini</p>
          <p className="text-lg font-bold text-slate-800">{todaySummary.jadwal}</p>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2">
          <p className="text-xs text-slate-500">Belum Dimulai</p>
          <p className="text-lg font-bold text-amber-700">{todaySummary.pendingMulai}</p>
        </div>
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2">
          <p className="text-xs text-slate-500">Sesi Aktif</p>
          <p className="text-lg font-bold text-blue-700">{todaySummary.sesiAktif}</p>
        </div>
        <div className="rounded-xl border border-green-100 bg-green-50 px-3 py-2">
          <p className="text-xs text-slate-500">Sesi Selesai</p>
          <p className="text-lg font-bold text-green-600">{todaySummary.checkOut}</p>
        </div>
      </div>

      <Card className="rounded-3xl">
        <CardContent className="space-y-4 p-6">
          <h3 className="text-base font-bold text-slate-900">Prioritas Aksi</h3>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Operasional</p>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              <Link to={MAPEL_SESSION_ROUTE} className="rounded-xl border border-slate-200 bg-slate-50 p-4 hover:bg-slate-100 transition-colors">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Operasional</p>
                <p className="mt-1 font-bold text-slate-800">Sesi & Absensi</p>
                <p className="mt-1 text-xs text-slate-600">Check-in/out, agenda, dan absensi siswa.</p>
              </Link>
              <Link to={MAPEL_SCORE_ROUTE} className="rounded-xl border border-slate-200 bg-slate-50 p-4 hover:bg-slate-100 transition-colors">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Operasional</p>
                <p className="mt-1 font-bold text-slate-800">Penilaian Keaktifan</p>
                <p className="mt-1 text-xs text-slate-600">Input penilaian keaktifan siswa per sesi.</p>
              </Link>
              <Link to={MAPEL_SCHEDULE_ROUTE} className="rounded-xl border border-slate-200 bg-slate-50 p-4 hover:bg-slate-100 transition-colors">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Operasional</p>
                <p className="mt-1 font-bold text-slate-800">Jadwal Mengajar</p>
                <p className="mt-1 text-xs text-slate-600">Lihat dan kelola jadwal mapel aktif.</p>
              </Link>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Laporan</p>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              <Link to={MAPEL_HISTORY_ROUTE} className="rounded-xl border border-slate-200 bg-slate-50 p-4 hover:bg-slate-100 transition-colors">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pelaporan</p>
                <p className="mt-1 font-bold text-slate-800">Riwayat Sesi</p>
                <p className="mt-1 text-xs text-slate-600">Cek histori agenda, absensi, dan status sesi.</p>
              </Link>
              <Link to={MAPEL_SCORE_RECAP_ROUTE} className="rounded-xl border border-slate-200 bg-slate-50 p-4 hover:bg-slate-100 transition-colors">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pelaporan</p>
                <p className="mt-1 font-bold text-slate-800">Rekap Penilaian Keaktifan</p>
                <p className="mt-1 text-xs text-slate-600">Rekap periodik penilaian keaktifan per siswa.</p>
              </Link>
              <Link to={MAPEL_RECAP_ROUTE} className="rounded-xl border border-slate-200 bg-slate-50 p-4 hover:bg-slate-100 transition-colors">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pelaporan</p>
                <p className="mt-1 font-bold text-slate-800">Rekap Kehadiran</p>
                <p className="mt-1 text-xs text-slate-600">Rekap H/S/I/A dan tingkat kehadiran per siswa.</p>
              </Link>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to={MAPEL_SCHEDULE_ROUTE}>
              <Button variant="secondary" size="sm">
                Kelola Jadwal
              </Button>
            </Link>
            {canOpenAudit && (
              <Link to={MAPEL_AUDIT_ROUTE}>
                <Button variant="ghost" size="sm" className="border-slate-300">
                  Audit Trail
                </Button>
              </Link>
            )}
            <div className="ml-auto rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Hadir: <span className="font-bold text-blue-700">{todaySummary.hadir}</span> • Tidak Masuk:{' '}
              <span className="font-bold text-rose-700">{todaySummary.tidakMasuk}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
};

export default MapelHomePage;
