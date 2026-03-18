import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { Loader2 } from 'lucide-react';

import { supabase } from '../../../supabaseClient';
import { fetchMapelTeacherPerformance } from '../../../services/mapelService';
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
  });

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
        limit: 400,
      });
      setPerformance(data);
    } catch (error) {
      Swal.fire('Gagal', error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [kelasId, rangeDays]);

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

  return (
    <PageContainer className="space-y-5">
      <PageHeader className="block">
        <PageTitle className="text-2xl md:text-3xl">Teacher Performance</PageTitle>
        <PageSubtitle className="mt-2 normal-case tracking-wide text-slate-500">
          Monitoring performa kehadiran guru mapel, check-in/out, tingkat keterlambatan, dan jumlah sesi mengajar.
        </PageSubtitle>
      </PageHeader>

      <Card>
        <CardContent className="grid grid-cols-1 gap-3 p-5 md:grid-cols-5 md:p-6">
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
        </CardContent>
      </Card>

      <p className="text-xs text-gray-500">
        Periode data: <span className="font-semibold text-gray-700">{periodLabel}</span>
      </p>

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

      <Card>
        <CardContent className="p-0">
          {loading && (
            <div className="p-10 text-center">
              <Loader2 className="mx-auto animate-spin text-blue-600" size={28} />
            </div>
          )}
          {!loading && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] text-sm">
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
                    </tr>
                  ))}
                    {performance.rows.length === 0 && (
                      <tr>
                        <td colSpan={10} className="px-3 py-8 text-center text-sm text-gray-500">
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
