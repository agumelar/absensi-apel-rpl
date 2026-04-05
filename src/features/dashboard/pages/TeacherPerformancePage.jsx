import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { Loader2 } from 'lucide-react';

import {
  fetchExecutiveDailyMonitoring,
  fetchMapelAuditFilterOptions,
  fetchMapelAuditSessionSummary,
  fetchMapelTeacherPerformance,
} from '../../../services/mapelService';
import { exportTeacherPerformanceToExcel } from '../../../services/shared/excelService';
import { getTodayDateWIB } from '../../../services/shared/dateService';
import Card, { CardContent } from '../../../shared/ui/Card';
import { PageContainer, PageHeader, PageSubtitle, PageTitle } from '../../../shared/ui/PageLayout';

const TAB = {
  MONITOR: 'monitor',
  MONTHLY: 'monthly',
};

const toPeriodRangeForMonth = (monthValue) => {
  const [year, month] = String(monthValue || '').split('-').map((value) => Number(value));
  if (!year || !month) {
    const today = getTodayDateWIB();
    const [yy, mm] = today.split('-');
    return {
      fromDate: `${yy}-${mm}-01`,
      toDate: today,
      monthLabel: `${yy}-${mm}`,
    };
  }

  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const fromDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const toDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return {
    fromDate,
    toDate,
    monthLabel: `${year}-${String(month).padStart(2, '0')}`,
  };
};

const formatSlaLabel = (item) => {
  if (!item) return '-';
  if (item.type === 'warning') return 'Breach';
  if (item.type === 'on_window') return 'On Window';
  if (item.type === 'checked_in') return 'Aman';
  if (item.type === 'absent') return 'Tidak Masuk';
  return '-';
};

const formatTimeToHourMinute = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
};

const TeacherPerformancePage = ({ user }) => {
  const [activeTab, setActiveTab] = useState(TAB.MONITOR);
  const [loadingMonitor, setLoadingMonitor] = useState(false);
  const [loadingMonthly, setLoadingMonthly] = useState(false);
  const [monitorRows, setMonitorRows] = useState([]);
  const [monthly, setMonthly] = useState({ summary: {}, rows: [] });
  const [historyRows, setHistoryRows] = useState([]);
  const [absenceRows, setAbsenceRows] = useState([]);
  const [kelasOptions, setKelasOptions] = useState([]);

  const todayDate = useMemo(() => getTodayDateWIB(), []);
  const [historyFromDate, setHistoryFromDate] = useState(todayDate);
  const [historyToDate, setHistoryToDate] = useState(todayDate);
  const [selectedMonth, setSelectedMonth] = useState(todayDate.slice(0, 7));
  const [guruKeyword, setGuruKeyword] = useState('');
  const [kelasFilter, setKelasFilter] = useState('all');

  const userRole = String(user?.role || '').toLowerCase();
  const isKaprog = userRole === 'kaprog';

  const loadMonitor = useCallback(async () => {
    try {
      setLoadingMonitor(true);

      const [snapshot, auditSummary] = await Promise.all([
        fetchExecutiveDailyMonitoring({ tanggal: todayDate }),
        fetchMapelAuditSessionSummary({
          fromDate: todayDate,
          toDate: todayDate,
          page: 1,
          pageSize: 200,
        }),
      ]);

      const auditMap = new Map((auditSummary.rows || []).map((item) => [String(item.schedule?.id || item.schedule_id || ''), item]));
      const composed = (snapshot.rows || []).map((item) => {
        const detail = auditMap.get(String(item.schedule_id || ''));
        return {
          ...item,
          tanggal: todayDate,
          sla_label: formatSlaLabel(item),
          agenda_topik: detail?.agenda_topik || '-',
          agenda_metode: detail?.agenda_metode || '-',
          attendance_summary: detail?.attendance_summary || { hadir: 0, sakit: 0, izin: 0, alpha: 0 },
          delivered_by_picket: Boolean(detail?.absence_task?.delivered_by_picket || item.delivered_by_picket),
          delivered_at: detail?.absence_task?.delivered_at || '-',
          instruksi: detail?.absence_task?.instruksi || '-',
        };
      });

      setMonitorRows(composed);
    } catch (error) {
      Swal.fire('Gagal', error.message, 'error');
    } finally {
      setLoadingMonitor(false);
    }
  }, [todayDate]);

  const loadKelasOptions = useCallback(async () => {
    try {
      const options = await fetchMapelAuditFilterOptions();
      setKelasOptions(options.kelasOptions || []);
    } catch (error) {
      Swal.fire('Gagal', error.message, 'error');
    }
  }, []);

  const loadMonthly = useCallback(async () => {
    try {
      setLoadingMonthly(true);
      const { fromDate, toDate } = toPeriodRangeForMonth(selectedMonth);
      const requestedKelasId = kelasFilter !== 'all' ? Number(kelasFilter) : undefined;

      const [performanceData, historyData] = await Promise.all([
        fetchMapelTeacherPerformance({
          fromDate,
          toDate,
          kelasId: requestedKelasId,
          trendBy: 'guru_nama',
          limit: 800,
        }),
        fetchMapelAuditSessionSummary({
          fromDate: historyFromDate,
          toDate: historyToDate,
          kelasId: requestedKelasId,
          page: 1,
          pageSize: 300,
        }),
      ]);

      const keyword = String(guruKeyword || '').trim().toLowerCase();
      const filteredRows = (performanceData.rows || []).filter((item) => {
        if (!keyword) return true;
        return String(item.guru_nama || '').toLowerCase().includes(keyword);
      });

      const filteredHistory = (historyData.rows || []).filter((item) => {
        if (!keyword) return true;
        return String(item.guru_nama || '').toLowerCase().includes(keyword);
      });

      const absenceOnly = filteredHistory.filter((item) => String(item.status || '').toLowerCase().trim() === 'tidak masuk');

      const totalCheckIns = filteredRows.reduce((sum, row) => sum + Number(row.check_in_sessions || 0), 0);
      const totalCheckOuts = filteredRows.reduce((sum, row) => sum + Number(row.check_out_sessions || 0), 0);
      const checkOutCompletionRate =
        totalCheckIns > 0 ? Math.round((totalCheckOuts / totalCheckIns) * 1000) / 10 : 0;

      setMonthly({
        summary: {
          ...performanceData.summary,
          totalCheckIns,
          totalCheckOuts,
          checkOutCompletionRate,
          fromDate,
          toDate,
        },
        rows: filteredRows,
      });
      setHistoryRows(filteredHistory);
      setAbsenceRows(
        absenceOnly.map((item) => ({
          ...item,
          delivered_by_picket: Boolean(item.absence_task?.delivered_by_picket),
          delivered_at: item.absence_task?.delivered_at || '-',
          instruksi: item.absence_task?.instruksi || '-',
        })),
      );
    } catch (error) {
      Swal.fire('Gagal', error.message, 'error');
    } finally {
      setLoadingMonthly(false);
    }
  }, [guruKeyword, historyFromDate, historyToDate, kelasFilter, selectedMonth]);

  useEffect(() => {
    loadKelasOptions();
  }, [loadKelasOptions]);

  useEffect(() => {
    loadMonitor();
  }, [loadMonitor]);

  useEffect(() => {
    loadMonthly();
  }, [loadMonthly]);

  useEffect(() => {
    setKelasFilter('all');
  }, [selectedMonth]);

  const periodLabel = useMemo(() => {
    const from = monthly.summary?.fromDate || '-';
    const to = monthly.summary?.toDate || '-';
    return `${from} s/d ${to}`;
  }, [monthly.summary?.fromDate, monthly.summary?.toDate]);

  const handleExport = async () => {
    await exportTeacherPerformanceToExcel({
      meta: {
        periodeLabel: periodLabel,
        bulanLabel: selectedMonth,
        roleScopeLabel: isKaprog ? 'Kaprog (Jurusan)' : 'Global Executive',
        trendByLabel: 'Guru',
        holidayPolicyLabel: 'Tanggal libur sekolah dikecualikan dari rekap',
      },
      summary: {
        presenceRate: monthly.summary.averagePresenceRate,
        lateRate: monthly.summary.averageLateRate,
        tidakMasukRate: monthly.summary.tidakMasukRate,
        checkOutCompletionRate: monthly.summary.checkOutCompletionRate,
        slaBreachRate: monthly.summary.slaBreachRate,
        impactedClasses: monthly.summary.impactedClasses,
      },
      rows: monthly.rows,
      monitorRows,
      historyRows,
      absenceRows,
      fileName: `Teacher_Performance_${selectedMonth}.xlsx`,
    });
  };

  return (
    <PageContainer className="space-y-5">
      <PageHeader className="block">
        <PageTitle className="text-2xl md:text-3xl">Teacher Performance</PageTitle>
        <PageSubtitle className="mt-2 normal-case tracking-wide text-slate-500">
          Versi sederhana executive: monitor hari ini, rekap performa bulanan, riwayat tanggal, dan export Excel multi-sheet.
        </PageSubtitle>
      </PageHeader>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveTab(TAB.MONITOR)}
          className={`rounded-lg px-4 py-2 text-xs font-black uppercase tracking-wide ${
            activeTab === TAB.MONITOR ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
          }`}
        >
          Monitor Hari Ini
        </button>
        <button
          onClick={() => setActiveTab(TAB.MONTHLY)}
          className={`rounded-lg px-4 py-2 text-xs font-black uppercase tracking-wide ${
            activeTab === TAB.MONTHLY ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
          }`}
        >
          Rekap Bulanan + Riwayat
        </button>
      </div>

      {activeTab === TAB.MONITOR && (
        <Card>
          <CardContent className="p-0">
            {loadingMonitor && (
              <div className="p-8 text-center">
                <Loader2 className="mx-auto animate-spin text-blue-600" size={26} />
              </div>
            )}
            {!loadingMonitor && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1400px] text-xs">
                  <thead className="bg-slate-50 text-[11px] uppercase text-slate-600">
                    <tr>
                      <th className="px-3 py-3 text-left">Tanggal</th>
                      <th className="px-3 py-3 text-left">Jam</th>
                      <th className="px-3 py-3 text-left">Guru</th>
                      <th className="px-3 py-3 text-left">Kelas</th>
                      <th className="px-3 py-3 text-left">Mapel</th>
                      <th className="px-3 py-3 text-left">SLA</th>
                      <th className="px-3 py-3 text-left">Check-In</th>
                      <th className="px-3 py-3 text-left">Check-Out</th>
                      <th className="px-3 py-3 text-left">Agenda</th>
                      <th className="px-3 py-3 text-right">H</th>
                      <th className="px-3 py-3 text-right">S</th>
                      <th className="px-3 py-3 text-right">I</th>
                      <th className="px-3 py-3 text-right">A</th>
                      <th className="px-3 py-3 text-left">Tugas Saat Tidak Masuk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monitorRows.map((row) => (
                      <tr key={`${row.schedule_id}-${row.session_id || 'n/a'}`} className="border-t border-slate-100">
                        <td className="px-3 py-2">{row.tanggal || '-'}</td>
                        <td className="px-3 py-2">{`${String(row.jam_mulai || '').slice(0, 5)}-${String(row.jam_selesai || '').slice(0, 5)}`}</td>
                        <td className="px-3 py-2 font-semibold">{row.guru_nama}</td>
                        <td className="px-3 py-2">{row.kelas_nama}</td>
                        <td className="px-3 py-2">{row.mapel_nama}</td>
                        <td className="px-3 py-2">{row.sla_label}</td>
                        <td className="px-3 py-2">{formatTimeToHourMinute(row.waktu_check_in)}</td>
                        <td className="px-3 py-2">{formatTimeToHourMinute(row.waktu_check_out)}</td>
                        <td className="px-3 py-2">{`${row.agenda_topik || '-'} / ${row.agenda_metode || '-'}`}</td>
                        <td className="px-3 py-2 text-right">{row.attendance_summary?.hadir || 0}</td>
                        <td className="px-3 py-2 text-right">{row.attendance_summary?.sakit || 0}</td>
                        <td className="px-3 py-2 text-right">{row.attendance_summary?.izin || 0}</td>
                        <td className="px-3 py-2 text-right">{row.attendance_summary?.alpha || 0}</td>
                        <td className="px-3 py-2">
                          {String(row.session_status || '').toLowerCase() === 'tidak masuk'
                            ? `${row.instruksi || '-'} • Delivered: ${row.delivered_by_picket ? 'Ya' : 'Tidak'}`
                            : '-'}
                        </td>
                      </tr>
                    ))}
                    {monitorRows.length === 0 && (
                      <tr>
                        <td colSpan={14} className="px-3 py-8 text-center text-slate-500">
                          Tidak ada jadwal/sesi monitor hari ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === TAB.MONTHLY && (
        <>
          <Card>
            <CardContent className="grid grid-cols-1 gap-3 p-5 md:grid-cols-6 md:p-6">
              <label className="text-xs font-bold text-slate-600">
                Bulan
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(event) => setSelectedMonth(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                />
              </label>
              <label className="text-xs font-bold text-slate-600">
                Cari Nama Guru
                <input
                  value={guruKeyword}
                  onChange={(event) => setGuruKeyword(event.target.value)}
                  placeholder="contoh: budi"
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                />
              </label>
              <label className="text-xs font-bold text-slate-600">
                Kelas
                <select
                  value={kelasFilter}
                  onChange={(event) => setKelasFilter(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                >
                  <option value="all">Semua Kelas</option>
                  {kelasOptions.map((kelas) => (
                    <option key={kelas.id} value={kelas.id}>
                      {kelas.nama_kelas}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-bold text-slate-600">
                Riwayat Dari
                <input
                  type="date"
                  value={historyFromDate}
                  onChange={(event) => setHistoryFromDate(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                />
              </label>
              <label className="text-xs font-bold text-slate-600">
                Riwayat Sampai
                <input
                  type="date"
                  value={historyToDate}
                  onChange={(event) => setHistoryToDate(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                />
              </label>
              <div className="flex items-end gap-2">
                <button
                  onClick={loadMonthly}
                  disabled={loadingMonthly}
                  className="w-full rounded-lg bg-blue-600 px-3 py-2 text-xs font-black uppercase tracking-wide text-white disabled:opacity-50"
                >
                  {loadingMonthly ? 'Memuat...' : 'Refresh'}
                </button>
                <button
                  onClick={handleExport}
                  disabled={loadingMonthly}
                  className="w-full rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black uppercase tracking-wide text-white disabled:opacity-50"
                >
                  Export
                </button>
              </div>
            </CardContent>
          </Card>

          <p className="text-xs text-slate-500">
            Periode bulan: <span className="font-semibold text-slate-700">{periodLabel}</span>
          </p>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1200px] text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                    <tr>
                      <th className="px-3 py-3 text-left">Guru</th>
                      <th className="px-3 py-3 text-right">Total Sesi</th>
                      <th className="px-3 py-3 text-right">Hadir</th>
                      <th className="px-3 py-3 text-right">Terlambat</th>
                      <th className="px-3 py-3 text-right">Tidak Masuk</th>
                      <th className="px-3 py-3 text-right">Tidak Check-Out</th>
                      <th className="px-3 py-3 text-right">Presence</th>
                      <th className="px-3 py-3 text-right">Late</th>
                      <th className="px-3 py-3 text-right">Check-Out Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthly.rows.map((row) => {
                      const tidakCheckOut = Math.max(0, Number(row.check_in_sessions || 0) - Number(row.check_out_sessions || 0));
                      return (
                        <tr key={row.guru_id} className="border-t border-slate-100">
                          <td className="px-3 py-2 font-semibold">{row.guru_nama}</td>
                          <td className="px-3 py-2 text-right">{row.total_sessions}</td>
                          <td className="px-3 py-2 text-right text-green-700 font-bold">{row.hadir_sessions}</td>
                          <td className="px-3 py-2 text-right text-amber-700 font-bold">{row.telat_sessions}</td>
                          <td className="px-3 py-2 text-right text-rose-700 font-bold">{row.tidak_masuk_sessions}</td>
                          <td className="px-3 py-2 text-right text-orange-700 font-bold">{tidakCheckOut}</td>
                          <td className="px-3 py-2 text-right">{row.presence_rate}%</td>
                          <td className="px-3 py-2 text-right">{row.late_rate}%</td>
                          <td className="px-3 py-2 text-right">{row.check_out_rate === null ? '-' : `${row.check_out_rate}%`}</td>
                        </tr>
                      );
                    })}
                    {monthly.rows.length === 0 && (
                      <tr>
                        <td colSpan={9} className="px-3 py-8 text-center text-slate-500">
                          Belum ada data rekap bulanan untuk filter ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-700">Riwayat Detail (Filter Tanggal)</p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[1100px] text-xs">
                  <thead className="bg-slate-50 text-[11px] uppercase text-slate-600">
                    <tr>
                      <th className="px-3 py-2 text-left">Tanggal</th>
                      <th className="px-3 py-2 text-left">Guru</th>
                      <th className="px-3 py-2 text-left">Kelas</th>
                      <th className="px-3 py-2 text-left">Mapel</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-left">Check-In</th>
                      <th className="px-3 py-2 text-left">Check-Out</th>
                      <th className="px-3 py-2 text-left">Agenda</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyRows.map((row) => (
                      <tr key={row.id} className="border-t border-slate-100">
                        <td className="px-3 py-2">{row.tanggal || '-'}</td>
                        <td className="px-3 py-2">{row.guru_nama || '-'}</td>
                        <td className="px-3 py-2">{row.kelas_nama || '-'}</td>
                        <td className="px-3 py-2">{row.mapel_nama || '-'}</td>
                        <td className="px-3 py-2">{row.status || '-'}</td>
                        <td className="px-3 py-2">{formatTimeToHourMinute(row.waktu_check_in)}</td>
                        <td className="px-3 py-2">{formatTimeToHourMinute(row.waktu_check_out)}</td>
                        <td className="px-3 py-2">{`${row.agenda_topik || '-'} / ${row.agenda_metode || '-'}`}</td>
                      </tr>
                    ))}
                    {historyRows.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-3 py-6 text-center text-slate-500">
                          Tidak ada riwayat pada rentang tanggal ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </PageContainer>
  );
};

export default TeacherPerformancePage;
