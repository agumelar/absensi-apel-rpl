import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { Loader2 } from 'lucide-react';

import { supabase } from '../../../supabaseClient';
import { fetchMapelTeacherPerformance } from '../../../services/mapelService';
import { exportTeacherPerformanceToExcel } from '../../../services/shared/excelService';
import { getTodayDateWIB } from '../../../services/shared/dateService';
import Card, { CardContent } from '../../../shared/ui/Card';
import { PageContainer, PageHeader, PageSubtitle, PageTitle } from '../../../shared/ui/PageLayout';

const TeacherPerformancePage = ({ user }) => {
  const [loading, setLoading] = useState(false);
  const [rangeDays, setRangeDays] = useState(7);
  const [kelasId, setKelasId] = useState('all');
  const [kelasOptions, setKelasOptions] = useState([]);
  const [performance, setPerformance] = useState({
    summary: {
      totalSessions: 0,
      totalTeachers: 0,
      totalCheckIns: 0,
      totalCheckOuts: 0,
      averagePresenceRate: 0,
      averageLateRate: 0,
    },
    rows: [],
    trendRows: [],
    alertRows: [],
    impactedRows: [],
  });
  const [trendBy, setTrendBy] = useState('guru_nama');

  const userRole = String(user?.role || '').toLowerCase();
  const isKaprog = userRole === 'kaprog';

  const loadKelasOptions = useCallback(async () => {
    try {
      let kaprogJurusanId = Number.parseInt(user?.jurusan_id, 10);
      if (isKaprog && (!Number.isInteger(kaprogJurusanId) || kaprogJurusanId <= 0)) {
        const kaprogId = user?.walikelas_id || user?.id;
        if (kaprogId) {
          const { data: kaprogRow, error: kaprogError } = await supabase
            .from('walikelas')
            .select('jurusan_id')
            .eq('id', kaprogId)
            .maybeSingle();
          if (kaprogError) throw kaprogError;
          kaprogJurusanId = Number.parseInt(kaprogRow?.jurusan_id, 10);
        }
      }

      let kelasQuery = supabase.from('master_kelas').select('id, nama_kelas, jurusan_id').order('nama_kelas');
      if (isKaprog && Number.isInteger(kaprogJurusanId) && kaprogJurusanId > 0) {
        kelasQuery = kelasQuery.eq('jurusan_id', kaprogJurusanId);
      }

      const { data, error } = await kelasQuery;
      if (error) throw error;
      setKelasOptions(data || []);
    } catch (error) {
      Swal.fire('Gagal', error.message, 'error');
    }
  }, [isKaprog, user?.id, user?.jurusan_id, user?.walikelas_id]);

  const loadPerformance = useCallback(async () => {
    try {
      setLoading(true);
      const toDate = getTodayDateWIB();
      const fromDateObj = new Date(`${toDate}T00:00:00+07:00`);
      fromDateObj.setDate(fromDateObj.getDate() - Math.max(0, Number(rangeDays) - 1));
      const fromDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(fromDateObj);

      const data = await fetchMapelTeacherPerformance({
        fromDate,
        toDate,
        kelasId: kelasId === 'all' ? undefined : Number.parseInt(kelasId, 10),
        trendBy,
        limit: 400,
      });
      setPerformance(data);
    } catch (error) {
      Swal.fire('Gagal', error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [kelasId, rangeDays, trendBy]);

  const handleExport = async () => {
    if (!performance.rows?.length) {
      await Swal.fire('Tidak ada data', 'Belum ada data teacher performance untuk diexport.', 'info');
      return;
    }

    await exportTeacherPerformanceToExcel({
      meta: {
        periodeLabel: periodLabel,
        roleScopeLabel: isKaprog ? 'Kaprog (Jurusan)' : 'Global Executive',
        trendByLabel: trendBy === 'kelas_nama' ? 'Kelas' : trendBy === 'mapel_nama' ? 'Mapel' : 'Guru',
      },
      summary: {
        presenceRate: performance.summary.averagePresenceRate,
        lateRate: performance.summary.averageLateRate,
        tidakMasukRate: performance.summary.tidakMasukRate,
        slaBreachRate: performance.summary.slaBreachRate,
        impactedClasses: performance.summary.impactedClasses,
      },
      rows: performance.rows,
      fileName: `Teacher_Performance_${performance.summary?.fromDate || 'from'}_${performance.summary?.toDate || 'to'}.xlsx`,
    });
  };

  useEffect(() => {
    loadKelasOptions();
  }, [loadKelasOptions]);

  useEffect(() => {
    loadPerformance();
  }, [loadPerformance]);

  const periodLabel = useMemo(() => {
    const from = performance.summary?.fromDate || '-';
    const to = performance.summary?.toDate || '-';
    return `${from} s/d ${to}`;
  }, [performance.summary?.fromDate, performance.summary?.toDate]);

  const trendPreviewRows = useMemo(() => {
    return (performance.trendRows || []).slice(-8).map((row) => {
      const presenceRate = row.total > 0 ? Math.round((row.hadir / row.total) * 1000) / 10 : 0;
      const lateRate = row.hadir > 0 ? Math.round((row.late / row.hadir) * 1000) / 10 : 0;
      return {
        ...row,
        presenceRate,
        lateRate,
      };
    });
  }, [performance.trendRows]);

  return (
    <PageContainer className="space-y-5">
      <PageHeader className="block">
        <PageTitle className="text-2xl md:text-3xl">Teacher Performance</PageTitle>
        <PageSubtitle className="mt-2 normal-case tracking-wide text-slate-500">
          Monitoring performa kehadiran guru mapel, check-in/out, tingkat keterlambatan (toleransi 15 menit), dan jumlah sesi mengajar.
        </PageSubtitle>
      </PageHeader>

      <Card>
        <CardContent className="grid grid-cols-1 gap-3 p-5 md:grid-cols-6 md:p-6">
          <label className="text-xs font-bold text-gray-600">
            Kelas
            <select
              value={kelasId}
              onChange={(event) => setKelasId(event.target.value)}
              className="w-full mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2"
            >
              <option value="all">Semua Kelas</option>
              {kelasOptions.map((kelas) => (
                <option key={kelas.id} value={kelas.id}>
                  {kelas.nama_kelas}
                </option>
              ))}
            </select>
          </label>
          <div className="md:col-span-3 space-y-2">
            <p className="text-xs font-bold text-gray-600">Rentang Waktu</p>
            <div className="flex flex-wrap gap-2">
              {[7, 14, 30].map((days) => (
                <button
                  key={days}
                  onClick={() => setRangeDays(days)}
                  className={`rounded-lg px-3 py-2 text-[11px] font-black uppercase tracking-wide ${
                    rangeDays === days ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {days} Hari
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {[
                { value: 'guru_nama', label: 'Tren Guru' },
                { value: 'kelas_nama', label: 'Tren Kelas' },
                { value: 'mapel_nama', label: 'Tren Mapel' },
              ].map((item) => (
                <button
                  key={item.value}
                  onClick={() => setTrendBy(item.value)}
                  className={`rounded-lg px-3 py-2 text-[11px] font-black uppercase tracking-wide ${
                    trendBy === item.value ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-end">
            <button
              onClick={loadPerformance}
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 px-3 py-2 text-[11px] font-black uppercase tracking-wide text-white disabled:opacity-50"
            >
              {loading ? 'Memuat...' : 'Refresh'}
            </button>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleExport}
              disabled={loading || performance.rows.length === 0}
              className="w-full rounded-lg bg-emerald-600 px-3 py-2 text-[11px] font-black uppercase tracking-wide text-white disabled:opacity-50"
            >
              Export Excel
            </button>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-gray-500">
        Periode data: <span className="font-semibold text-gray-700">{periodLabel}</span>
      </p>

      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        <span className="rounded-full bg-slate-100 px-3 py-1 font-bold text-slate-700">
          Scope: {performance.summary.roleScope === 'jurusan' ? 'Jurusan (Kaprog)' : 'Global Executive'}
        </span>
        <span className="rounded-full bg-amber-50 px-3 py-1 font-bold text-amber-700">
          Alert SLA: {performance.alertRows?.length || 0}
        </span>
        <span className="rounded-full bg-sky-50 px-3 py-1 font-bold text-sky-700">
          Titik Tren: {performance.trendRows?.length || 0}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
          <p className="text-xs text-slate-500">Total Sesi</p>
          <p className="text-2xl font-black text-slate-800">{performance.summary.totalSessions}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
          <p className="text-xs text-slate-500">Total Guru</p>
          <p className="text-2xl font-black text-slate-800">{performance.summary.totalTeachers}</p>
        </div>
        <div className="rounded-xl border border-green-100 bg-green-50 px-3 py-3">
          <p className="text-xs text-slate-500">Average Presence</p>
          <p className="text-2xl font-black text-green-700">{performance.summary.averagePresenceRate}%</p>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-3">
          <p className="text-xs text-slate-500">Average Late</p>
          <p className="text-2xl font-black text-amber-700">{performance.summary.averageLateRate}%</p>
        </div>
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-3">
          <p className="text-xs text-slate-500">Total Check-in</p>
          <p className="text-2xl font-black text-blue-700">{performance.summary.totalCheckIns}</p>
        </div>
        <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-3">
          <p className="text-xs text-slate-500">Total Check-out</p>
          <p className="text-2xl font-black text-indigo-700">{performance.summary.totalCheckOuts}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-3">
          <p className="text-xs text-slate-500">Tidak Masuk Rate</p>
          <p className="text-2xl font-black text-rose-700">{performance.summary.tidakMasukRate || 0}%</p>
        </div>
        <div className="rounded-xl border border-orange-100 bg-orange-50 px-3 py-3">
          <p className="text-xs text-slate-500">SLA Breach Rate</p>
          <p className="text-2xl font-black text-orange-700">{performance.summary.slaBreachRate || 0}%</p>
        </div>
        <div className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-3">
          <p className="text-xs text-slate-500">Kelas Terdampak</p>
          <p className="text-2xl font-black text-sky-700">{performance.summary.impactedClasses || 0}</p>
        </div>
      </div>

      {performance.alertRows?.length > 0 && (
        <Card>
          <CardContent className="space-y-2 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-amber-700">Alert Tindak Lanjut SLA</p>
            {performance.alertRows.slice(0, 8).map((item) => (
              <div key={item.session_id} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <p className="font-bold">
                  {item.kelas_nama} • {item.mapel_nama}
                </p>
                <p>
                  {item.guru_nama} • {item.warning_label}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-700">Preview Tren (8 titik terakhir)</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
                  <tr>
                    <th className="px-2 py-2 text-left">Tanggal</th>
                    <th className="px-2 py-2 text-left">Dimensi</th>
                    <th className="px-2 py-2 text-right">Total</th>
                    <th className="px-2 py-2 text-right">Presence</th>
                    <th className="px-2 py-2 text-right">Late</th>
                  </tr>
                </thead>
                <tbody>
                  {trendPreviewRows.map((row) => (
                    <tr key={`${row.tanggal}-${row.dimension}`} className="border-t border-slate-100">
                      <td className="px-2 py-2">{row.tanggal}</td>
                      <td className="px-2 py-2 font-semibold">{row.dimension}</td>
                      <td className="px-2 py-2 text-right">{row.total}</td>
                      <td className="px-2 py-2 text-right text-green-700">{row.presenceRate}%</td>
                      <td className="px-2 py-2 text-right text-amber-700">{row.lateRate}%</td>
                    </tr>
                  ))}
                  {trendPreviewRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-2 py-6 text-center text-slate-500">
                        Belum ada data tren pada filter ini.
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
            <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-700">Kelas Terdampak (harian)</p>
            <div className="space-y-2">
              {(performance.impactedRows || []).slice(-8).map((item) => (
                <div key={item.tanggal} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs">
                  <span className="font-semibold text-slate-700">{item.tanggal}</span>
                  <span className="font-black text-sky-700">{item.impactedClasses} kelas</span>
                </div>
              ))}
              {(performance.impactedRows || []).length === 0 && (
                <p className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">
                  Tidak ada kelas terdampak pada periode ini.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading && (
            <div className="p-10 text-center">
              <Loader2 className="mx-auto animate-spin text-blue-600" size={28} />
            </div>
          )}
          {!loading && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px] text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="px-3 py-3 text-left">Guru</th>
                    <th className="px-3 py-3 text-left">Kelas / Mapel Terakhir</th>
                    <th className="px-3 py-3 text-right">Total Sesi</th>
                    <th className="px-3 py-3 text-right">Hadir</th>
                    <th className="px-3 py-3 text-right">Check-in</th>
                    <th className="px-3 py-3 text-right">Check-out</th>
                    <th className="px-3 py-3 text-right">Tidak Masuk</th>
                    <th className="px-3 py-3 text-right">Pending</th>
                    <th className="px-3 py-3 text-right">Presence</th>
                    <th className="px-3 py-3 text-right">Late Ratio</th>
                    <th className="px-3 py-3 text-right">Check-out Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {performance.rows.map((row) => (
                    <tr key={row.guru_id} className="border-t border-gray-100">
                      <td className="px-3 py-3 font-semibold">{row.guru_nama}</td>
                      <td className="px-3 py-3 text-gray-600">
                        {row.kelas_terakhir} • {row.mapel_terakhir}
                      </td>
                      <td className="px-3 py-3 text-right font-bold">{row.total_sessions}</td>
                      <td className="px-3 py-3 text-right font-bold text-green-700">{row.hadir_sessions}</td>
                      <td className="px-3 py-3 text-right font-bold text-blue-700">{row.check_in_sessions}</td>
                      <td className="px-3 py-3 text-right font-bold text-indigo-700">{row.check_out_sessions}</td>
                      <td className="px-3 py-3 text-right font-bold text-amber-700">{row.tidak_masuk_sessions}</td>
                      <td className="px-3 py-3 text-right font-bold text-slate-600">{row.pending_sessions}</td>
                      <td className="px-3 py-3 text-right font-bold text-green-700">{row.presence_rate}%</td>
                      <td className="px-3 py-3 text-right font-bold text-amber-700">{row.late_rate}%</td>
                      <td className="px-3 py-3 text-right font-bold text-indigo-700">
                        {row.check_out_rate === null ? '-' : `${row.check_out_rate}%`}
                      </td>
                    </tr>
                  ))}
                  {performance.rows.length === 0 && (
                    <tr>
                      <td colSpan={11} className="px-3 py-8 text-center text-sm text-gray-500">
                        Belum ada data teacher performance pada rentang/filter ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
};

export default TeacherPerformancePage;
