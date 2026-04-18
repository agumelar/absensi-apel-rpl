import React, { useMemo, useState } from 'react';
import Swal from 'sweetalert2';

import { fetchExecutivePembiasaanReport } from '../../../services/pembiasaanService';
import { exportWorkbookWithSheets } from '../../../services/shared/excelService';
import { getDateDaysAgoWIB, getTodayDateWIB } from '../../../services/shared/dateService';
import {
  buildDetailHistoryExportRows,
  buildDailyMonitoringExportRows,
  buildDailyMonitoringRows,
  formatCheckinAtToWIB,
} from '../utils/executivePembiasaanReportRules';
import Button from '../../../shared/ui/Button';
import Card, { CardContent } from '../../../shared/ui/Card';
import { PageContainer, PageHeader, PageSubtitle, PageTitle } from '../../../shared/ui/PageLayout';

const ExecutivePembiasaanReportPage = () => {
  const [fromDate, setFromDate] = useState(getDateDaysAgoWIB(6));
  const [toDate, setToDate] = useState(getTodayDateWIB());
  const [activityType, setActivityType] = useState('all');
  const [status, setStatus] = useState('all');
  const [focusDate, setFocusDate] = useState(getTodayDateWIB());
  const [activeTab, setActiveTab] = useState('monitoring');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState({ summary: null, rows: [], monitoringRows: [], recapRows: [], scope: 'global' });

  const monitoringRows = useMemo(
    () => buildDailyMonitoringRows(report.monitoringRows || report.rows || [], { focusDate, status }),
    [focusDate, report.monitoringRows, report.rows, status],
  );

  const recapRows = useMemo(() => report.recapRows || [], [report.recapRows]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await fetchExecutivePembiasaanReport({ fromDate, toDate, activityType, status });
      setReport(data);
    } catch (error) {
      Swal.fire('Gagal', error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!report.rows.length) {
      Swal.fire('Info', 'Belum ada data untuk diexport.', 'info');
      return;
    }

    const summaryRows = [
      { metric: 'Scope', value: report.scope },
      { metric: 'Total', value: report.summary?.total || 0 },
      { metric: 'Hadir', value: report.summary?.hadir || 0 },
      { metric: 'Izin', value: report.summary?.izin || 0 },
      { metric: 'Sakit', value: report.summary?.sakit || 0 },
      { metric: 'Alpha', value: report.summary?.alpha || 0 },
      { metric: 'Hari Aktif Sekolah', value: report.activeDaysCount || 0 },
      { metric: 'Hari Libur Dikecualikan', value: report.excludedHolidayCount || 0 },
    ];
    const monitoringExportRows = buildDailyMonitoringExportRows(monitoringRows);
    const detailHistoryExportRows = buildDetailHistoryExportRows(report.rows);

    await exportWorkbookWithSheets({
      fileName: `Laporan_Pembiasaan_${fromDate}_${toDate}.xlsx`,
      sheets:
        activeTab === 'monitoring'
          ? [
              { name: 'Dashboard_Ringkas', rows: summaryRows },
              { name: 'Monitoring_Harian', rows: monitoringExportRows },
              { name: 'Riwayat_Detail', rows: detailHistoryExportRows },
            ]
          : [
              { name: 'Dashboard_Ringkas', rows: summaryRows },
              { name: 'Rekap_Guru', rows: recapRows },
              { name: 'Riwayat_Detail', rows: detailHistoryExportRows },
            ],
    });

    Swal.fire('Berhasil', 'Export laporan pembiasaan selesai.', 'success');
  };

  return (
    <PageContainer className="space-y-5">
      <PageHeader className="block">
        <PageTitle className="text-3xl">Laporan Pembiasaan</PageTitle>
        <PageSubtitle className="mt-2">Monitoring Harian dan Rekap Guru berbasis hari aktif sekolah.</PageSubtitle>
      </PageHeader>

      <Card>
        <CardContent className="grid grid-cols-1 gap-3 p-5 md:grid-cols-7">
          <label className="text-xs font-bold text-slate-600">
            Dari
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Sampai
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2" />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Aktivitas
            <select value={activityType} onChange={(e) => setActivityType(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <option value="all">Semua</option>
              <option value="sapa_pagi">Sapa Pagi</option>
              <option value="pembiasaan">Pembiasaan</option>
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600">
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <option value="all">Semua</option>
              <option value="hadir">Hadir</option>
              <option value="izin">Izin</option>
              <option value="sakit">Sakit</option>
              <option value="alpha">Alpha</option>
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600">
            Tanggal Fokus
            <input type="date" value={focusDate} onChange={(e) => setFocusDate(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2" />
          </label>
          <div className="flex items-end">
            <Button onClick={fetchData} disabled={loading}>{loading ? 'Memuat...' : 'Refresh'}</Button>
          </div>
          <div className="flex items-end">
            <Button variant="secondary" onClick={handleExport} disabled={loading || report.rows.length === 0}>Export</Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button variant={activeTab === 'monitoring' ? 'primary' : 'secondary'} onClick={() => setActiveTab('monitoring')}>
          Monitoring Harian
        </Button>
        <Button variant={activeTab === 'rekap' ? 'primary' : 'secondary'} onClick={() => setActiveTab('rekap')}>
          Rekap Guru
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <Card><CardContent className="p-4"><p className="text-xs">Scope</p><p className="text-lg font-black">{report.scope}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs">Total</p><p className="text-lg font-black">{report.summary?.total || 0}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs">Hadir</p><p className="text-lg font-black text-emerald-600">{report.summary?.hadir || 0}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs">Izin</p><p className="text-lg font-black text-blue-600">{report.summary?.izin || 0}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs">Sakit</p><p className="text-lg font-black text-amber-600">{report.summary?.sakit || 0}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs">Alpha</p><p className="text-lg font-black text-rose-600">{report.summary?.alpha || 0}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            {activeTab === 'monitoring' ? (
              <table className="w-full min-w-[1050px] text-xs">
                <thead className="bg-slate-50 text-[11px] uppercase text-slate-600">
                  <tr>
                    <th className="px-3 py-2 text-left">Tanggal</th>
                    <th className="px-3 py-2 text-left">Aktivitas</th>
                    <th className="px-3 py-2 text-left">Nama</th>
                    <th className="px-3 py-2 text-left">Role</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-left">Jam</th>
                    <th className="px-3 py-2 text-left">Jarak (m)</th>
                    <th className="px-3 py-2 text-left">Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {monitoringRows.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100">
                      <td className="px-3 py-2">{row.tanggal || '-'}</td>
                      <td className="px-3 py-2">{row.activity_type || '-'}</td>
                      <td className="px-3 py-2">{row.nama_lengkap || '-'}</td>
                      <td className="px-3 py-2">{row.role || '-'}</td>
                      <td className="px-3 py-2">{row.status || '-'}</td>
                      <td className="px-3 py-2">{formatCheckinAtToWIB(row.checkin_at)}</td>
                      <td className="px-3 py-2">{row.distance_meter || '-'}</td>
                      <td className="px-3 py-2">{row.note || '-'}</td>
                    </tr>
                  ))}
                  {monitoringRows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-8 text-center text-slate-500">Belum ada data monitoring untuk tanggal fokus ini.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              <table className="w-full min-w-[1000px] text-xs">
                <thead className="bg-slate-50 text-[11px] uppercase text-slate-600">
                  <tr>
                    <th className="px-3 py-2 text-left">Nama Guru</th>
                    <th className="px-3 py-2 text-left">Role</th>
                    <th className="px-3 py-2 text-left">Hadir</th>
                    <th className="px-3 py-2 text-left">Izin</th>
                    <th className="px-3 py-2 text-left">Sakit</th>
                    <th className="px-3 py-2 text-left">Alpha</th>
                    <th className="px-3 py-2 text-left">Total Aktual</th>
                    <th className="px-3 py-2 text-left">Total Kewajiban</th>
                    <th className="px-3 py-2 text-left">Kepatuhan (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {recapRows.map((row) => (
                    <tr key={row.user_id} className="border-t border-slate-100">
                      <td className="px-3 py-2">{row.nama_lengkap || '-'}</td>
                      <td className="px-3 py-2">{row.role || '-'}</td>
                      <td className="px-3 py-2">{row.hadir || 0}</td>
                      <td className="px-3 py-2">{row.izin || 0}</td>
                      <td className="px-3 py-2">{row.sakit || 0}</td>
                      <td className="px-3 py-2">{row.alpha || 0}</td>
                      <td className="px-3 py-2">{row.total_aktual || 0}</td>
                      <td className="px-3 py-2">{row.total_kewajiban || 0}</td>
                      <td className="px-3 py-2">{row.kepatuhan_persen || 0}</td>
                    </tr>
                  ))}
                  {recapRows.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-3 py-8 text-center text-slate-500">Belum ada data rekap guru untuk filter ini.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
};

export default ExecutivePembiasaanReportPage;
