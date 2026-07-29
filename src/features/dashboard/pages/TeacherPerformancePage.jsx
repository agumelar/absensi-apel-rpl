import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Download,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  Trophy,
} from 'lucide-react';

import {
  fetchExecutiveDailyMonitoring,
  fetchMapelAuditFilterOptions,
  fetchMapelAuditSessionSummary,
  fetchMapelTeacherPerformance,
} from '../../../services/mapelService';
import { exportTeacherPerformanceToExcel } from '../../../services/shared/excelService';
import { getTodayDateWIB } from '../../../services/shared/dateService';
import { MAPEL_AUDIT_ROUTE } from '../../../shared/constants/routes';
import Card, { CardContent } from '../../../shared/ui/Card';
import { PageContainer, PageHeader, PageSubtitle, PageTitle } from '../../../shared/ui/PageLayout';

const TAB = {
  MONITOR: 'monitor',
  MONTHLY: 'monthly',
};

const toPeriodRangeForMonth = (monthValue) => {
  const [year, month] = String(monthValue || '').split('-').map(Number);
  const today = getTodayDateWIB();
  if (!year || !month) {
    return { fromDate: `${today.slice(0, 7)}-01`, toDate: today };
  }

  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    fromDate: `${year}-${String(month).padStart(2, '0')}-01`,
    toDate: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
  };
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

const formatRate = (value, denominator) => (Number(denominator || 0) > 0 ? `${Number(value || 0)}%` : '—');

const getMonitorStatus = (item) => {
  if (item?.type === 'warning' && String(item?.warning_label || '').startsWith('Lupa Absen')) {
    return { label: 'Lupa Absen / Tidak Absen', tone: 'bg-rose-100 text-rose-700' };
  }
  if (item?.type === 'warning') return { label: 'Belum Check-in >15 menit', tone: 'bg-rose-100 text-rose-700' };
  if (item?.type === 'on_window') return { label: 'Menunggu Check-in', tone: 'bg-amber-100 text-amber-700' };
  if (item?.type === 'checked_in') return { label: 'Sudah Check-in', tone: 'bg-emerald-100 text-emerald-700' };
  if (item?.type === 'absent') return { label: 'Tidak Masuk', tone: 'bg-rose-100 text-rose-700' };
  return { label: 'Belum ada status', tone: 'bg-slate-100 text-slate-600' };
};

const getAttentionLevel = (score) => {
  const value = Number(score || 0);
  if (value >= 12) {
    return {
      label: 'Prioritas Tinggi',
      badgeTone: 'bg-rose-100 text-rose-700 dark:bg-rose-900/70 dark:text-rose-200',
      scoreTone:
        'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/70 dark:text-rose-200',
    };
  }
  if (value >= 5) {
    return {
      label: 'Perlu Perhatian',
      badgeTone: 'bg-amber-100 text-amber-700 dark:bg-amber-900/70 dark:text-amber-200',
      scoreTone:
        'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/70 dark:text-amber-200',
    };
  }
  return {
    label: 'Terpantau',
    badgeTone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/70 dark:text-emerald-200',
    scoreTone:
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-200',
  };
};

const KpiCard = ({ icon, label, value, note, tone = 'slate' }) => {
  const tones = {
    slate: 'border-slate-200 bg-white text-slate-700',
    green: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-700',
    rose: 'border-rose-100 bg-rose-50 text-rose-700',
    blue: 'border-sky-100 bg-sky-50 text-sky-700',
  };

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone] || tones.slate}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
        {React.createElement(icon, { size: 18 })}
      </div>
      <p className="mt-3 text-3xl font-black">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{note}</p>
    </div>
  );
};

const TeacherPerformancePage = ({ user }) => {
  const [activeTab, setActiveTab] = useState(TAB.MONITOR);
  const [loadingMonitor, setLoadingMonitor] = useState(false);
  const [loadingMonthly, setLoadingMonthly] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [monitorRows, setMonitorRows] = useState([]);
  const [monthly, setMonthly] = useState({ summary: {}, rows: [] });
  const [kelasOptions, setKelasOptions] = useState([]);

  const todayDate = useMemo(() => getTodayDateWIB(), []);
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
        fetchMapelAuditSessionSummary({ fromDate: todayDate, toDate: todayDate, page: 1, pageSize: 200 }),
      ]);

      const auditMap = new Map(
        (auditSummary.rows || []).map((item) => [String(item.schedule?.id || item.schedule_id || ''), item]),
      );
      setMonitorRows(
        (snapshot.rows || []).map((item) => {
          const detail = auditMap.get(String(item.schedule_id || ''));
          return {
            ...item,
            tanggal: todayDate,
            monitor_status: getMonitorStatus(item),
            agenda_topik: detail?.agenda_topik || '-',
            attendance_summary: detail?.attendance_summary || { hadir: 0, sakit: 0, izin: 0, alpha: 0 },
          };
        }),
      );
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
      const data = await fetchMapelTeacherPerformance({
        fromDate,
        toDate,
        kelasId: kelasFilter !== 'all' ? Number(kelasFilter) : undefined,
        trendBy: 'guru_nama',
        limit: 800,
      });
      setMonthly(data);
    } catch (error) {
      Swal.fire('Gagal', error.message, 'error');
    } finally {
      setLoadingMonthly(false);
    }
  }, [kelasFilter, selectedMonth]);

  useEffect(() => {
    loadKelasOptions();
  }, [loadKelasOptions]);

  useEffect(() => {
    loadMonitor();
  }, [loadMonitor]);

  useEffect(() => {
    loadMonthly();
  }, [loadMonthly]);

  const filteredRanking = useMemo(() => {
    const keyword = String(guruKeyword || '').trim().toLowerCase();
    if (!keyword) return monthly.rows || [];
    return (monthly.rows || []).filter((item) => String(item.guru_nama || '').toLowerCase().includes(keyword));
  }, [guruKeyword, monthly.rows]);

  const monitorAttentionRows = useMemo(
    () => monitorRows.filter((row) => ['warning', 'absent'].includes(row.type) || (row.waktu_check_in && !row.waktu_check_out)),
    [monitorRows],
  );

  const handleExport = async () => {
    try {
      setExporting(true);
      const { fromDate, toDate } = toPeriodRangeForMonth(selectedMonth);
      const requestedKelasId = kelasFilter !== 'all' ? kelasFilter : undefined;
      const firstPage = await fetchMapelAuditSessionSummary({
        fromDate,
        toDate,
        kelasId: requestedKelasId,
        page: 1,
        pageSize: 200,
      });
      let historyRows = [...(firstPage.rows || [])];
      for (let page = 2; page <= firstPage.totalPages; page += 1) {
        const nextPage = await fetchMapelAuditSessionSummary({
          fromDate,
          toDate,
          kelasId: requestedKelasId,
          page,
          pageSize: 200,
        });
        historyRows = historyRows.concat(nextPage.rows || []);
      }

      const keyword = String(guruKeyword || '').trim().toLowerCase();
      if (keyword) {
        historyRows = historyRows.filter((row) => String(row.guru_nama || '').toLowerCase().includes(keyword));
      }
      const absenceRows = historyRows.filter((row) =>
        ['lupa_absen', 'confirmed_absence'].includes(String(row.attention_type || '')),
      );
      const effectiveFromDate = monthly.summary.fromDate || firstPage.summary?.fromDate || fromDate;
      const effectiveToDate = monthly.summary.toDate || firstPage.summary?.toDate || toDate;

      await exportTeacherPerformanceToExcel({
        meta: {
          periodeLabel: `${effectiveFromDate} s/d ${effectiveToDate}`,
          bulanLabel: selectedMonth,
          roleScopeLabel: isKaprog ? 'Kaprog (Jurusan)' : 'Global Executive',
          trendByLabel: 'Peringkat Perhatian Guru',
          holidayPolicyLabel: 'Monitoring mulai 20 Juli 2026; hari libur dan jadwal yang belum dimulai tidak dinilai',
        },
        summary: {
          totalTeachers: monthly.summary.totalTeachers,
          totalSessions: monthly.summary.totalSessions,
          totalScheduled: monthly.summary.totalScheduled,
          totalHadir: monthly.summary.totalHadir,
          totalLupaAbsen: monthly.summary.totalLupaAbsen,
          totalConfirmedAbsence: monthly.summary.totalConfirmedAbsence,
          totalSlaBreach: monthly.summary.totalSlaBreach,
          totalLate: monthly.summary.totalLate,
          totalMissingCheckOut: monthly.summary.totalMissingCheckOut,
          presenceRate: monthly.summary.averagePresenceRate,
          lateRate: monthly.summary.averageLateRate,
          tidakMasukRate: monthly.summary.tidakMasukRate,
          checkOutCompletionRate:
            Number(monthly.summary.totalCheckIns || 0) > 0
              ? Math.round((Number(monthly.summary.totalCheckOuts || 0) / Number(monthly.summary.totalCheckIns)) * 1000) / 10
              : 0,
          slaBreachRate: monthly.summary.slaBreachRate,
          impactedClasses: monthly.summary.impactedClasses,
        },
        rows: filteredRanking,
        monitorRows,
        historyRows,
        absenceRows,
        fileName: `Teacher_Performance_${selectedMonth}.xlsx`,
      });
    } catch (error) {
      Swal.fire('Gagal export', error.message, 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <PageContainer className="space-y-5">
      <PageHeader className="block md:block">
        <PageTitle className="text-2xl md:text-3xl">Kinerja Kehadiran Guru</PageTitle>
        <PageSubtitle className="mt-2 normal-case tracking-wide text-slate-500">
          Monitoring dan peringkat perhatian untuk pembinaan internal. Peringkat 1 menunjukkan guru yang paling perlu ditinjau.
        </PageSubtitle>
      </PageHeader>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab(TAB.MONITOR)}
            className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wide ${
              activeTab === TAB.MONITOR ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700'
            }`}
          >
            Monitor Hari Ini
          </button>
          <button
            onClick={() => setActiveTab(TAB.MONTHLY)}
            className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wide ${
              activeTab === TAB.MONTHLY ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700'
            }`}
          >
            Peringkat Bulanan
          </button>
        </div>
        <Link
          to={MAPEL_AUDIT_ROUTE}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-wide text-slate-700"
        >
          Buka Riwayat Sesi
        </Link>
      </div>

      {activeTab === TAB.MONITOR && (
        <>
          <div className="grid gap-3 md:grid-cols-3">
            <KpiCard icon={CalendarClock} label="Jadwal Hari Ini" value={monitorRows.length} note={todayDate} tone="blue" />
            <KpiCard
              icon={ShieldAlert}
              label="Perlu Tindak Lanjut"
              value={monitorAttentionRows.length}
              note="Belum check-in, tidak masuk, atau belum check-out"
              tone={monitorAttentionRows.length > 0 ? 'rose' : 'green'}
            />
            <KpiCard
              icon={CheckCircle2}
              label="Sudah Check-in"
              value={monitorRows.filter((row) => Boolean(row.waktu_check_in)).length}
              note="Sesi yang telah memiliki bukti check-in"
              tone="green"
            />
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-4">
                <div>
                  <h2 className="font-black text-slate-900">Perhatian Hari Ini</h2>
                  <p className="text-xs text-slate-500">Diurutkan untuk tindak lanjut cepat oleh Kurikulum/Kaprog.</p>
                </div>
                <button
                  onClick={loadMonitor}
                  disabled={loadingMonitor}
                  className="rounded-lg bg-slate-100 p-2 text-slate-700 disabled:opacity-50"
                  aria-label="Refresh monitor"
                >
                  <RefreshCw size={16} className={loadingMonitor ? 'animate-spin' : ''} />
                </button>
              </div>
              {loadingMonitor ? (
                <div className="p-10 text-center">
                  <Loader2 className="mx-auto animate-spin text-blue-600" size={26} />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] text-sm">
                    <thead className="bg-slate-50 text-[11px] uppercase text-slate-600">
                      <tr>
                        <th className="px-4 py-3 text-left">Guru & Pelajaran</th>
                        <th className="px-4 py-3 text-left">Kelas / Jam</th>
                        <th className="px-4 py-3 text-left">Status</th>
                        <th className="px-4 py-3 text-left">Check-in / Check-out</th>
                        <th className="px-4 py-3 text-left">Agenda / Siswa</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monitorRows.map((row) => (
                        <tr key={`${row.schedule_id}-${row.session_id || 'n/a'}`} className="border-t border-slate-100 align-top">
                          <td className="px-4 py-3">
                            <p className="font-bold text-slate-900">{row.guru_nama}</p>
                            <p className="text-xs text-slate-500">{row.mapel_nama}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-semibold">{row.kelas_nama}</p>
                            <p className="text-xs text-slate-500">
                              {String(row.jam_mulai || '').slice(0, 5)}–{String(row.jam_selesai || '').slice(0, 5)}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${row.monitor_status.tone}`}>
                              {row.monitor_status.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {formatTimeToHourMinute(row.waktu_check_in)} / {formatTimeToHourMinute(row.waktu_check_out)}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <p>{row.agenda_topik || 'Belum ada agenda'}</p>
                            <p className="mt-1 text-slate-500">
                              H {row.attendance_summary?.hadir || 0} • S {row.attendance_summary?.sakit || 0} • I{' '}
                              {row.attendance_summary?.izin || 0} • A {row.attendance_summary?.alpha || 0}
                            </p>
                          </td>
                        </tr>
                      ))}
                      {monitorRows.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                            Tidak ada jadwal aktif untuk hari ini.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {activeTab === TAB.MONTHLY && (
        <>
          <Card>
            <CardContent className="grid grid-cols-1 gap-3 p-5 md:grid-cols-2 xl:grid-cols-3">
              <label className="text-xs font-bold text-slate-600">
                Bulan Penilaian
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(event) => setSelectedMonth(event.target.value)}
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
                    <option key={kelas.id} value={kelas.id}>{kelas.nama_kelas}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-bold text-slate-600 md:col-span-2 xl:col-span-1">
                Cari Guru
                <span className="relative mt-1 block">
                  <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                  <input
                    value={guruKeyword}
                    onChange={(event) => setGuruKeyword(event.target.value)}
                    placeholder="Ketik nama guru"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3"
                  />
                </span>
              </label>
              <div className="flex items-end gap-2 md:col-span-2 xl:col-span-1">
                <button
                  onClick={loadMonthly}
                  disabled={loadingMonthly}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-black uppercase text-white disabled:opacity-50"
                >
                  <RefreshCw size={14} className={loadingMonthly ? 'animate-spin' : ''} /> Muat
                </button>
                <button
                  onClick={handleExport}
                  disabled={loadingMonthly || exporting}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black uppercase text-white disabled:opacity-50"
                >
                  <Download size={14} /> {exporting ? 'Proses' : 'Excel'}
                </button>
              </div>
            </CardContent>
          </Card>

          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-xs text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
            <p className="font-black dark:text-blue-100">Cara membaca peringkat perhatian</p>
            <p className="mt-1 leading-relaxed">
              Skor: lupa absen ×4, belum check-in melewati SLA ×3, terlambat ×2, tidak masuk terkonfirmasi ×2,
              dan belum check-out ×1. Monitoring dimulai 20 Juli 2026; hari libur serta jadwal yang belum dimulai tidak dihitung.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-5">
            <KpiCard
              icon={CalendarClock}
              label="Jadwal Dinilai"
              value={monthly.summary.totalScheduled || 0}
              note={`${monthly.summary.fromDate || '-'} s/d ${monthly.summary.toDate || '-'}`}
              tone="blue"
            />
            <KpiCard
              icon={CheckCircle2}
              label="Kehadiran"
              value={formatRate(monthly.summary.averagePresenceRate, monthly.summary.totalScheduled)}
              note={`${monthly.summary.totalHadir || 0} sesi memiliki check-in`}
              tone="green"
            />
            <KpiCard
              icon={ShieldAlert}
              label="Lupa Absen"
              value={monthly.summary.totalLupaAbsen || 0}
              note="Jadwal selesai tanpa sesi/check-in"
              tone="rose"
            />
            <KpiCard
              icon={Clock3}
              label="Terlambat"
              value={monthly.summary.totalLate || 0}
              note={formatRate(monthly.summary.averageLateRate, monthly.summary.totalHadir)}
              tone="amber"
            />
            <KpiCard
              icon={AlertTriangle}
              label="Belum Check-out"
              value={monthly.summary.totalMissingCheckOut || 0}
              note="Sudah check-in, sesi berakhir, tanpa check-out"
              tone="amber"
            />
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="border-b border-slate-100 p-4">
                <div className="flex items-center gap-2">
                  <Trophy className="text-amber-500" size={20} />
                  <h2 className="font-black text-slate-900">Peringkat Perhatian Guru</h2>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Nomor 1 memiliki skor berbobot tertinggi dan menjadi prioritas peninjauan.
                </p>
              </div>
              {loadingMonthly ? (
                <div className="p-10 text-center">
                  <Loader2 className="mx-auto animate-spin text-blue-600" size={26} />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1040px] text-sm">
                    <thead className="bg-slate-50 text-[11px] uppercase text-slate-600">
                      <tr>
                        <th className="px-4 py-3 text-center">Peringkat</th>
                        <th className="px-4 py-3 text-left">Guru</th>
                        <th className="px-4 py-3 text-right">Jadwal</th>
                        <th className="px-4 py-3 text-right">Lupa Absen</th>
                        <th className="px-4 py-3 text-right">Tidak Masuk Dilaporkan</th>
                        <th className="px-4 py-3 text-right">Terlambat</th>
                        <th className="px-4 py-3 text-right">Belum Check-out</th>
                        <th className="px-4 py-3 text-right">Kehadiran</th>
                        <th className="min-w-[190px] px-4 py-3 text-left">Skor Perhatian</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRanking.map((row, index) => {
                        const level = getAttentionLevel(row.attention_score);
                        return (
                          <tr key={row.guru_id} className="border-t border-slate-100">
                            <td className="px-4 py-3 text-center">
                              <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full font-black ${
                                index === 0 ? 'bg-rose-600 text-white' : index < 3 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                              }`}>
                                {index + 1}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-bold text-slate-900">{row.guru_nama}</p>
                              <p className="text-xs text-slate-500">{row.kelas_terakhir} • {row.mapel_terakhir}</p>
                            </td>
                            <td className="px-4 py-3 text-right font-semibold">{row.total_sessions}</td>
                            <td className="px-4 py-3 text-right font-black text-rose-700">{row.lupa_absen_sessions || 0}</td>
                            <td className="px-4 py-3 text-right font-bold text-orange-700">{row.confirmed_absence_sessions || 0}</td>
                            <td className="px-4 py-3 text-right font-bold text-amber-700">{row.telat_sessions || 0}</td>
                            <td className="px-4 py-3 text-right font-bold text-amber-700">{row.missing_check_out_sessions || 0}</td>
                            <td className="px-4 py-3 text-right font-bold">{formatRate(row.presence_rate, row.total_sessions)}</td>
                            <td className="min-w-[190px] px-4 py-3">
                              <div className="flex items-center gap-3">
                                <span
                                  className={`inline-flex h-12 min-w-12 items-center justify-center rounded-xl border px-2 text-lg font-black ${level.scoreTone}`}
                                  title="Skor berbobot indikator perhatian"
                                >
                                  {row.attention_score || 0}
                                </span>
                                <div className="min-w-0">
                                  <span
                                    className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${level.badgeTone}`}
                                  >
                                    {level.label}
                                  </span>
                                  <p className="mt-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
                                    Skor berbobot
                                  </p>
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {filteredRanking.length === 0 && (
                        <tr>
                          <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                            Belum ada jadwal yang telah dimulai untuk filter ini.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </PageContainer>
  );
};

export default TeacherPerformancePage;
