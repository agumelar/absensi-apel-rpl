import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Download,
  Loader2,
  RefreshCw,
  Users,
} from 'lucide-react';
import Swal from 'sweetalert2';

import { fetchExecutivePembiasaanReport } from '../../../services/pembiasaanService';
import { exportPembiasaanReportToExcel } from '../../../services/shared/excelService';
import { getDateDaysAgoWIB, getTodayDateWIB } from '../../../services/shared/dateService';
import {
  buildDetailHistoryExportRows,
  buildDailyMonitoringExportRows,
  buildDailyMonitoringRows,
  buildTeacherRecapExportRows,
  formatCheckinAtToWIB,
  formatPembiasaanActivityLabel,
  formatPembiasaanRoleLabel,
  formatPembiasaanStatusLabel,
  PEMBIASAAN_REPORT_START_DATE,
} from '../utils/executivePembiasaanReportRules';
import Button from '../../../shared/ui/Button';
import Card, { CardContent } from '../../../shared/ui/Card';
import { PageContainer, PageHeader, PageSubtitle, PageTitle } from '../../../shared/ui/PageLayout';

const PAGE_SIZE = 20;

const initialReport = {
  summary: null,
  rows: [],
  monitoringRows: [],
  recapRows: [],
  scope: 'global',
  fromDate: PEMBIASAAN_REPORT_START_DATE,
  toDate: getTodayDateWIB(),
  activeDaysCount: 0,
  excludedHolidayCount: 0,
};

const formatPercentage = (value) => `${Number(value || 0).toLocaleString('id-ID', { maximumFractionDigits: 1 })}%`;

const getStatusBadgeClass = (status) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'hadir') {
    return 'border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300';
  }
  if (normalized === 'izin') {
    return 'border-sky-200 bg-sky-100 text-sky-700 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-300';
  }
  if (normalized === 'sakit') {
    return 'border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300';
  }
  return 'border-rose-200 bg-rose-100 text-rose-700 dark:border-rose-800 dark:bg-rose-950/60 dark:text-rose-300';
};

const ActivitySummaryCard = ({ title, description, summary = {}, variant = 'blue' }) => {
  const isBlue = variant === 'blue';
  const shellClass = isBlue
    ? 'border-blue-200 bg-blue-50/70 dark:border-blue-900/70 dark:bg-blue-950/25'
    : 'border-violet-200 bg-violet-50/70 dark:border-violet-900/70 dark:bg-violet-950/25';
  const titleClass = isBlue ? 'text-blue-800 dark:text-blue-200' : 'text-violet-800 dark:text-violet-200';
  const barClass = isBlue ? 'bg-blue-600' : 'bg-violet-600';

  return (
    <div className={`rounded-2xl border p-4 ${shellClass}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className={`text-base font-black ${titleClass}`}>{title}</p>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{description}</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-black text-slate-900 dark:text-slate-100">{summary.obligations || 0}</p>
          <p className="text-[10px] font-bold uppercase text-slate-400">kewajiban</p>
        </div>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/90 dark:bg-slate-900">
        <div
          className={`h-full rounded-full ${barClass}`}
          style={{ width: `${Math.min(100, Number(summary.validReportRate || 0))}%` }}
        />
      </div>
      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
        {summary.scheduledParticipants || 0} personel terjadwal • {formatPercentage(summary.validReportRate)} sudah melapor
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-lg bg-white/80 p-2 dark:bg-slate-900/70">
          <p className="text-[9px] font-black uppercase text-slate-400">Sudah Melapor</p>
          <p className="mt-1 text-lg font-black text-blue-700 dark:text-blue-300">{summary.validReports || 0}</p>
          <p className="text-[9px] text-slate-400">Hadir + Izin + Sakit</p>
        </div>
        <div className="rounded-lg bg-white/80 p-2 dark:bg-slate-900/70">
          <p className="text-[9px] font-black uppercase text-slate-400">Hadir</p>
          <p className="mt-1 text-lg font-black text-emerald-600 dark:text-emerald-300">{summary.hadir || 0}</p>
          <p className="text-[9px] text-slate-400">{formatPercentage(summary.presenceRate)}</p>
        </div>
        <div className="rounded-lg bg-white/80 p-2 dark:bg-slate-900/70">
          <p className="text-[9px] font-black uppercase text-slate-400">Izin / Sakit</p>
          <p className="mt-1 text-lg font-black text-amber-600 dark:text-amber-300">
            {Number(summary.izin || 0) + Number(summary.sakit || 0)}
          </p>
          <p className="text-[9px] text-slate-400">I {summary.izin || 0} • S {summary.sakit || 0}</p>
        </div>
        <div className="rounded-lg bg-white/80 p-2 dark:bg-slate-900/70">
          <p className="text-[9px] font-black uppercase text-slate-400">Ditindaklanjuti</p>
          <p className="mt-1 text-lg font-black text-rose-600 dark:text-rose-300">{summary.needsAttention || 0}</p>
          <p className="text-[9px] text-slate-400">Alpha {summary.alpha || 0} • Kosong {summary.missingUnrecorded || 0}</p>
        </div>
      </div>
    </div>
  );
};

const ExecutivePembiasaanReportPage = () => {
  const today = useMemo(() => getTodayDateWIB(), []);
  const [filters, setFilters] = useState({
    fromDate: getDateDaysAgoWIB(6),
    toDate: today,
    activityType: 'all',
  });
  const [focusDate, setFocusDate] = useState(today);
  const [monitorStatus, setMonitorStatus] = useState('all');
  const [activeTab, setActiveTab] = useState('monitoring');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [report, setReport] = useState(initialReport);

  const monitoringRows = useMemo(
    () => buildDailyMonitoringRows(report.monitoringRows || report.rows || [], { focusDate, status: monitorStatus }),
    [focusDate, monitorStatus, report.monitoringRows, report.rows],
  );
  const recapRows = useMemo(() => report.recapRows || [], [report.recapRows]);
  const visibleRows = activeTab === 'monitoring' ? monitoringRows : recapRows;
  const totalPages = Math.max(1, Math.ceil(visibleRows.length / PAGE_SIZE));
  const pagedRows = useMemo(
    () => visibleRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [page, visibleRows],
  );

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchExecutivePembiasaanReport({
        fromDate: filters.fromDate,
        toDate: filters.toDate,
        activityType: filters.activityType,
        status: 'all',
      });
      setReport(data);
      setLoaded(true);
      setFocusDate((current) => {
        if (current >= data.fromDate && current <= data.toDate) return current;
        return data.toDate || today;
      });
      setPage(1);
    } catch (error) {
      Swal.fire('Gagal', error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [filters, today]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [activeTab, focusDate, monitorStatus]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const applyDatePreset = (daysAgo) => {
    setFilters((current) => ({
      ...current,
      fromDate: getDateDaysAgoWIB(daysAgo),
      toDate: today,
    }));
  };

  const handleExport = async () => {
    if (!loaded || recapRows.length === 0) {
      Swal.fire('Info', 'Belum ada data laporan untuk diekspor.', 'info');
      return;
    }

    const monitoringExportRows = buildDailyMonitoringExportRows(monitoringRows);
    const recapExportRows = buildTeacherRecapExportRows(recapRows);
    const detailHistoryExportRows = buildDetailHistoryExportRows(report.rows);

    await exportPembiasaanReportToExcel({
      fileName: `Laporan_Pembiasaan_${report.fromDate}_${report.toDate}.xlsx`,
      meta: {
        periodLabel: `${report.fromDate} s/d ${report.toDate}`,
        focusDate,
        activityType: filters.activityType,
        activityLabel:
          filters.activityType === 'all'
            ? 'Semua Aktivitas'
            : formatPembiasaanActivityLabel(filters.activityType),
        statusLabel: monitorStatus === 'all' ? 'Semua' : formatPembiasaanStatusLabel(monitorStatus),
        activeDaysCount: report.activeDaysCount || 0,
        excludedHolidayCount: report.excludedHolidayCount || 0,
      },
      summary: report.summary || {},
      monitoringRows: monitoringExportRows,
      rankingRows: recapExportRows,
      auditRows: detailHistoryExportRows,
    });

    Swal.fire('Berhasil', 'Export laporan pembiasaan selesai.', 'success');
  };

  return (
    <PageContainer className="space-y-5">
      <PageHeader className="block">
        <PageTitle className="text-2xl md:text-3xl">Laporan Pembiasaan</PageTitle>
        <PageSubtitle className="mt-2 normal-case tracking-wide text-slate-500">
          Monitoring seluruh personel sekolah sejak 20 Juli 2026. Laporan hanya membaca data; Alpha dibentuk oleh proses terjadwal.
        </PageSubtitle>
      </PageHeader>

      <Card>
        <CardContent className="grid grid-cols-1 gap-3 p-5 md:grid-cols-5">
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
            Dari
            <input
              type="date"
              min={PEMBIASAAN_REPORT_START_DATE}
              max={today}
              value={filters.fromDate}
              onChange={(event) => setFilters((current) => ({ ...current, fromDate: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
            />
          </label>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
            Sampai
            <input
              type="date"
              min={PEMBIASAAN_REPORT_START_DATE}
              max={today}
              value={filters.toDate}
              onChange={(event) => setFilters((current) => ({ ...current, toDate: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
            />
          </label>
          <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
            Aktivitas
            <select
              value={filters.activityType}
              onChange={(event) => setFilters((current) => ({ ...current, activityType: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="all">Semua Aktivitas</option>
              <option value="sapa_pagi">Sapa Pagi</option>
              <option value="pembiasaan">Pembiasaan</option>
            </select>
          </label>
          <div className="flex items-end gap-2 md:col-span-2">
            <Button onClick={() => applyDatePreset(0)} variant="secondary" size="sm">Hari Ini</Button>
            <Button onClick={() => applyDatePreset(6)} variant="secondary" size="sm">7 Hari</Button>
            <Button onClick={() => applyDatePreset(29)} variant="secondary" size="sm">30 Hari</Button>
            <Button onClick={fetchData} disabled={loading} size="sm">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Muat
            </Button>
            <Button onClick={handleExport} disabled={loading || !loaded} size="sm" className="bg-emerald-600 hover:bg-emerald-700">
              <Download size={14} /> Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
        <p>
          Periode efektif <strong className="text-slate-800 dark:text-slate-200">{report.fromDate} s/d {report.toDate}</strong>
        </p>
        <p>{report.activeDaysCount || 0} hari aktif • {report.excludedHolidayCount || 0} hari libur dikecualikan</p>
      </div>

      <div className="grid gap-3 md:grid-cols-[220px_1fr]">
        <div className="rounded-xl border border-sky-100 bg-sky-50 p-4 dark:border-sky-900/70 dark:bg-sky-950/40">
          <div className="flex items-center justify-between text-sky-700 dark:text-sky-300">
            <span className="text-[10px] font-black uppercase">Personel Sekolah</span>
            <Users size={16} />
          </div>
          <p className="mt-1 text-2xl font-black text-sky-800 dark:text-sky-200">{report.summary?.totalParticipants || 0}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{report.activeDaysCount || 0} hari aktif pada periode ini</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
          <p className="font-black text-slate-900 dark:text-slate-100">Cara membaca laporan</p>
          <p className="mt-1">
            <strong>Sudah Melapor</strong> berarti Hadir, Izin, atau Sakit. <strong>Ditindaklanjuti</strong> berarti Alpha atau belum ada catatan.
          </p>
          {filters.activityType === 'all' && (
            <p className="mt-1 text-slate-500 dark:text-slate-400">
              Petugas Sapa Pagi memiliki dua kewajiban pada hari tugasnya: Sapa Pagi dan Pembiasaan harian. Karena itu keduanya ditampilkan terpisah di bawah.
            </p>
          )}
        </div>
      </div>

      <div className={`grid gap-3 ${filters.activityType === 'all' ? 'xl:grid-cols-2' : 'grid-cols-1'}`}>
        {filters.activityType !== 'sapa_pagi' && (
          <ActivitySummaryCard
            title="Pembiasaan Harian"
            description="Kewajiban seluruh personel pada setiap hari aktif sekolah"
            summary={report.summary?.activities?.pembiasaan}
            variant="blue"
          />
        )}
        {filters.activityType !== 'pembiasaan' && (
          <ActivitySummaryCard
            title="Sapa Pagi"
            description="Khusus personel yang terjadwal sebagai petugas Sapa Pagi"
            summary={report.summary?.activities?.sapa_pagi}
            variant="violet"
          />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <Button variant={activeTab === 'monitoring' ? 'primary' : 'secondary'} onClick={() => setActiveTab('monitoring')} size="sm">
            Monitoring Harian
          </Button>
          <Button variant={activeTab === 'ranking' ? 'primary' : 'secondary'} onClick={() => setActiveTab('ranking')} size="sm">
            Peringkat Perhatian
          </Button>
        </div>
        {activeTab === 'monitoring' && (
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
              Tanggal Fokus
              <input
                type="date"
                min={report.fromDate}
                max={report.toDate}
                value={focusDate}
                onChange={(event) => setFocusDate(event.target.value)}
                className="ml-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
              Status
              <select
                value={monitorStatus}
                onChange={(event) => setMonitorStatus(event.target.value)}
                className="ml-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="all">Semua</option>
                <option value="hadir">Hadir</option>
                <option value="izin">Izin</option>
                <option value="sakit">Sakit</option>
                <option value="alpha">Alpha</option>
              </select>
            </label>
          </div>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center">
              <Loader2 className="mx-auto animate-spin text-blue-600" size={26} />
              <p className="mt-2 text-xs text-slate-500">Memuat laporan pembiasaan...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {activeTab === 'monitoring' ? (
                <table className="w-full min-w-[980px] text-xs">
                  <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 dark:bg-slate-900/80 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3 text-left">Tanggal</th>
                      <th className="px-4 py-3 text-left">Aktivitas</th>
                      <th className="px-4 py-3 text-left">Personel</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      <th className="px-4 py-3 text-left">Jam</th>
                      <th className="px-4 py-3 text-left">Jarak</th>
                      <th className="px-4 py-3 text-left">Sumber</th>
                      <th className="px-4 py-3 text-left">Catatan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedRows.map((row) => (
                      <tr key={row.id} className="border-t border-slate-100 text-slate-700 dark:border-slate-800 dark:text-slate-200">
                        <td className="whitespace-nowrap px-4 py-3">{row.tanggal || '—'}</td>
                        <td className="px-4 py-3 font-bold">{formatPembiasaanActivityLabel(row.activity_type)}</td>
                        <td className="px-4 py-3">
                          <p className="font-black text-slate-900 dark:text-slate-100">{row.nama_lengkap || '—'}</p>
                          <p className="text-[10px] text-slate-400">{formatPembiasaanRoleLabel(row.role)}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full border px-2 py-1 text-[10px] font-black ${getStatusBadgeClass(row.status)}`}>
                            {formatPembiasaanStatusLabel(row.status)}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold">{formatCheckinAtToWIB(row.checkin_at)}</td>
                        <td className="px-4 py-3">{row.distance_meter == null ? '—' : `${Math.round(row.distance_meter)} m`}</td>
                        <td className="px-4 py-3">
                          <span className={row.created_by_system ? 'font-bold text-rose-600 dark:text-rose-300' : 'text-slate-500 dark:text-slate-400'}>
                            {row.created_by_system ? 'Otomatis' : 'Dilaporkan'}
                          </span>
                        </td>
                        <td className="max-w-[260px] truncate px-4 py-3" title={row.note || ''}>{row.note || '—'}</td>
                      </tr>
                    ))}
                    {pagedRows.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                          Tidak ada catatan pada tanggal dan status yang dipilih.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              ) : (
                <table className="w-full min-w-[1050px] text-xs">
                  <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 dark:bg-slate-900/80 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3 text-left">Peringkat</th>
                      <th className="px-4 py-3 text-left">Personel</th>
                      <th className="px-4 py-3 text-center">Hadir</th>
                      <th className="px-4 py-3 text-center">Izin</th>
                      <th className="px-4 py-3 text-center">Sakit</th>
                      <th className="px-4 py-3 text-center">Alpha</th>
                      <th className="px-4 py-3 text-center">Belum Tercatat</th>
                      <th className="px-4 py-3 text-center">Perlu Perhatian</th>
                      <th className="px-4 py-3 text-left">Pelaporan Valid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedRows.map((row, index) => (
                      <tr
                        key={row.user_id}
                        className={`border-t border-slate-100 dark:border-slate-800 ${
                          row.perlu_perhatian > 0 ? 'bg-rose-50/30 dark:bg-rose-950/10' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-slate-100 px-2 font-black text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                            {(page - 1) * PAGE_SIZE + index + 1}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-black text-slate-900 dark:text-slate-100">{row.nama_lengkap || '—'}</p>
                          <p className="text-[10px] text-slate-400">{formatPembiasaanRoleLabel(row.role)}</p>
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-emerald-600 dark:text-emerald-300">{row.hadir}</td>
                        <td className="px-4 py-3 text-center text-sky-600 dark:text-sky-300">{row.izin}</td>
                        <td className="px-4 py-3 text-center text-amber-600 dark:text-amber-300">{row.sakit}</td>
                        <td className="px-4 py-3 text-center font-black text-rose-600 dark:text-rose-300">{row.alpha}</td>
                        <td className="px-4 py-3 text-center font-bold text-orange-600 dark:text-orange-300">{row.belum_tercatat}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                            row.perlu_perhatian > 0
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                              : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                          }`}>
                            {row.perlu_perhatian}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-black text-slate-800 dark:text-slate-100">{formatPercentage(row.pelaporan_valid_persen)}</p>
                          <p className="text-[10px] text-slate-400">{row.pelaporan_valid} dari {row.total_kewajiban} kewajiban</p>
                        </td>
                      </tr>
                    ))}
                    {pagedRows.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-4 py-10 text-center text-slate-500">Belum ada personel dalam laporan ini.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {!loading && visibleRows.length > 0 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Menampilkan {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, visibleRows.length)} dari {visibleRows.length}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
              Sebelumnya
            </Button>
            <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Halaman {page} / {totalPages}</span>
            <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
              Berikutnya
            </Button>
          </div>
        </div>
      )}
    </PageContainer>
  );
};

export default ExecutivePembiasaanReportPage;
