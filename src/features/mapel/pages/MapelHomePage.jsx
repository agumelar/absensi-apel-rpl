import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MAPEL_AUDIT_ROUTE,
  MAPEL_HISTORY_ROUTE,
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

const MapelHomePage = ({ user }) => {
  const [todaySummary, setTodaySummary] = useState({ jadwal: 0, sesi: 0, hadir: 0, tidakMasuk: 0 });
  const role = normalizeRole(user?.role);
  const canOpenAudit = isMapelAuditRole(role);
  const today = useMemo(() => getTodayDateWIB(), []);

  useEffect(() => {
    const loadSummary = async () => {
      if (!user?.id) return;
      const [schedules, sessions] = await Promise.all([fetchSchedulesByGuruToday(user.id, today), fetchSessionsByTanggal(today)]);
      const hadir = sessions.filter((item) => String(item.status || '').toLowerCase() === 'hadir').length;
      const tidakMasuk = sessions.filter((item) => {
        const status = String(item.status || '').toLowerCase();
        return status === 'tidak_masuk' || status === 'tidak masuk' || status === 'absent';
      }).length;
      setTodaySummary({
        jadwal: schedules.length,
        sesi: sessions.length,
        hadir,
        tidakMasuk,
      });
    };

    loadSummary().catch((error) => Swal.fire('Gagal', error.message, 'error'));
  }, [today, user?.id]);

  return (
    <PageContainer className="max-w-4xl">
      <PageHeader className="mb-5 block space-y-2">
        <PageTitle className="text-2xl md:text-3xl">Modul Guru Mapel</PageTitle>
        <PageSubtitle>Workspace KBM Digital</PageSubtitle>
      </PageHeader>

      <Card className="rounded-3xl">
        <CardContent className="space-y-5 p-6 md:p-7">
          <p className="text-sm text-slate-600">
            Entry point modul mapel sudah aktif. Halaman jadwal, sesi, dan absensi mapel terhubung sesuai alur
            operasional guru mapel.
          </p>

          <div className="flex flex-wrap gap-3">
            <Link to={MAPEL_SCHEDULE_ROUTE}>
              <Button size="lg">Buka Jadwal Mandiri</Button>
            </Link>
            <Link to={MAPEL_SESSION_ROUTE}>
              <Button variant="secondary" size="lg">
                Buka Sesi Hari Ini
              </Button>
            </Link>
            <Link to={MAPEL_SCORE_ROUTE}>
              <Button variant="secondary" size="lg">
                Input Nilai Harian
              </Button>
            </Link>
            <Link to={MAPEL_HISTORY_ROUTE}>
              <Button variant="secondary" size="lg">
                Riwayat Sesi
              </Button>
            </Link>
            {canOpenAudit && (
              <Link to={MAPEL_AUDIT_ROUTE}>
                <Button variant="ghost" size="lg" className="border-slate-300">
                  Buka Audit Trail
                </Button>
              </Link>
            )}
          </div>

          <div className="grid gap-2 md:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">Jadwal Hari Ini</p>
              <p className="text-lg font-bold text-slate-800">{todaySummary.jadwal}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">Sesi Tercatat</p>
              <p className="text-lg font-bold text-slate-800">{todaySummary.sesi}</p>
            </div>
            <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2">
              <p className="text-xs text-slate-500">Status Hadir</p>
              <p className="text-lg font-bold text-blue-700">{todaySummary.hadir}</p>
            </div>
            <div className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2">
              <p className="text-xs text-slate-500">Tidak Masuk</p>
              <p className="text-lg font-bold text-rose-700">{todaySummary.tidakMasuk}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
};

export default MapelHomePage;
