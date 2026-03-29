import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Filter,
  Info,
  Loader2,
  Printer,
  TrendingUp,
  Users,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import Swal from 'sweetalert2';

import { supabase } from '../../../services/supabase/client';
import {
  fetchGuruKosongEws,
  fetchTeacherAbsenceTasksForPicket,
  markTeacherAbsenceTaskDelivered,
} from '../../../services/mapelService';
import Card, { CardContent } from '../../../shared/ui/Card';
import { PageContainer, PageHeader, PageSubtitle, PageTitle } from '../../../shared/ui/PageLayout';

const getTodayDateWIB = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

const getDateRangeWIB = (dateValue) => ({
  start: `${dateValue}T00:00:00+07:00`,
  end: `${dateValue}T23:59:59+07:00`,
});

const COLORS = {
  Hadir: '#10b981',
  Terlambat: '#facc15',
  Sakit: '#f59e0b',
  Izin: '#3b82f6',
  Alpha: '#ef4444',
};

const EWS_BADGE = {
  warning: 'bg-red-100 text-red-700 border border-red-200',
  absent: 'bg-amber-100 text-amber-700 border border-amber-200',
  on_window: 'bg-blue-100 text-blue-700 border border-blue-200',
  checked_in: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
};

const EWS_LABEL = {
  warning: 'EWS Aktif',
  absent: 'Guru Tidak Masuk',
  on_window: 'Dalam SLA',
  checked_in: 'Aman',
};

const PiketDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [deliveringTaskId, setDeliveringTaskId] = useState(null);
  const [stats, setStats] = useState({ hadir: 0, terlambat: 0, sakit: 0, izin: 0, alpha: 0, totalSiswa: 0 });
  const [monitoringKelas, setMonitoringKelas] = useState([]);
  const [recentLogs, setRecentLogs] = useState([]);
  const [filterKelas, setFilterKelas] = useState('Semua');
  const [tanggal, setTanggal] = useState(getTodayDateWIB());
  const [daftarKelas, setDaftarKelas] = useState([]);
  const [guruKosongSummary, setGuruKosongSummary] = useState({
    total: 0,
    warning: 0,
    checkedIn: 0,
    absent: 0,
    onWindow: 0,
  });
  const [guruKosongRows, setGuruKosongRows] = useState([]);
  const [absenceTasks, setAbsenceTasks] = useState([]);

  const fetchPiketData = useCallback(async () => {
    try {
      setLoading(true);
      const kelasId = filterKelas === 'Semua' ? null : Number(filterKelas);
      const [masterKelasRes, walasRes, siswaRes] = await Promise.all([
        supabase.from('master_kelas').select('id, nama_kelas').order('nama_kelas', { ascending: true }),
        supabase.from('walikelas').select('nama_lengkap, kelas_id'),
        supabase.from('siswa').select('id, kelas_id').eq('status_siswa', 'Aktif'),
      ]);

      if (masterKelasRes.error) throw masterKelasRes.error;
      if (walasRes.error) throw walasRes.error;
      if (siswaRes.error) throw siswaRes.error;

      const listKelasMaster = masterKelasRes.data || [];
      const allWalas = walasRes.data || [];
      const allSiswa = siswaRes.data || [];
      setDaftarKelas(listKelasMaster);

      const filteredSiswa = kelasId ? allSiswa.filter((item) => Number(item.kelas_id) === kelasId) : allSiswa;
      const totalSiswaPerKelas = {};
      allSiswa.forEach((item) => {
        const key = Number(item.kelas_id);
        totalSiswaPerKelas[key] = (totalSiswaPerKelas[key] || 0) + 1;
      });

      let absensiQuery = supabase.from('absensi').select('status, siswa!inner(kelas_id)').eq('tanggal', tanggal);
      if (kelasId) {
        absensiQuery = absensiQuery.eq('siswa.kelas_id', kelasId);
      }
      const { data: dataAbsen, error: absenError } = await absensiQuery;
      if (absenError) throw absenError;

      const counts = { Hadir: 0, Sakit: 0, Izin: 0, Alpha: 0, Kesiangan: 0 };
      (dataAbsen || []).forEach((item) => {
        if (Object.prototype.hasOwnProperty.call(counts, item.status)) {
          counts[item.status] += 1;
        }
      });

      setStats({
        hadir: counts.Hadir,
        terlambat: counts.Kesiangan,
        sakit: counts.Sakit,
        izin: counts.Izin,
        alpha: counts.Alpha,
        totalSiswa: filteredSiswa.length,
      });

      const statusPerKelas = listKelasMaster
        .map((kelas) => {
          const jumlahTerabsen = (dataAbsen || []).filter((item) => Number(item.siswa?.kelas_id) === Number(kelas.id)).length;
          const totalSiswaDiKelas = totalSiswaPerKelas[Number(kelas.id)] || 0;
          const walasNama = allWalas.find((item) => Number(item.kelas_id) === Number(kelas.id))?.nama_lengkap || 'Belum Diatur';
          return {
            id: kelas.id,
            nama: kelas.nama_kelas,
            walas: walasNama,
            terabsen: jumlahTerabsen,
            total: totalSiswaDiKelas,
            isComplete: jumlahTerabsen >= totalSiswaDiKelas && totalSiswaDiKelas > 0,
          };
        })
        .filter((item) => !kelasId || Number(item.id) === kelasId);
      setMonitoringKelas(statusPerKelas);

      const range = getDateRangeWIB(tanggal);
      let logQuery = supabase
        .from('log_piket')
        .select('*, siswa!inner(nama_siswa, kelas_id, master_kelas(nama_kelas))')
        .gte('created_at', range.start)
        .lte('created_at', range.end)
        .order('created_at', { ascending: false })
        .limit(10);
      if (kelasId) {
        logQuery = logQuery.eq('siswa.kelas_id', kelasId);
      }
      const { data: logs, error: logError } = await logQuery;
      if (logError) throw logError;
      setRecentLogs(
        (logs || []).map((item) => ({
          ...item,
          siswa_nama: item.siswa?.nama_siswa || 'Siswa',
          siswa_kelas: item.siswa?.master_kelas?.nama_kelas || 'Kelas',
        })),
      );

      const [ewsData, taskData] = await Promise.all([
        fetchGuruKosongEws({ tanggal, kelasId }),
        fetchTeacherAbsenceTasksForPicket({ tanggal, kelasId }),
      ]);
      setGuruKosongSummary(ewsData.summary);
      setGuruKosongRows(ewsData.rows);
      setAbsenceTasks(taskData.rows);
    } finally {
      setLoading(false);
    }
  }, [filterKelas, tanggal]);

  useEffect(() => {
    fetchPiketData().catch((error) => {
      Swal.fire('Gagal memuat dashboard piket', error.message, 'error');
    });
  }, [fetchPiketData]);

  const chartData = useMemo(
    () =>
      [
        { name: 'Hadir', value: stats.hadir },
        { name: 'Terlambat', value: stats.terlambat },
        { name: 'Sakit', value: stats.sakit },
        { name: 'Izin', value: stats.izin },
        { name: 'Alpha', value: stats.alpha },
      ].filter((item) => item.value > 0),
    [stats.alpha, stats.hadir, stats.izin, stats.sakit, stats.terlambat],
  );

  const handleMarkDelivered = async (taskId) => {
    try {
      setDeliveringTaskId(taskId);
      const result = await markTeacherAbsenceTaskDelivered(taskId);
      await fetchPiketData();
      if (result?.audit_warning) {
        console.warn('Mapel audit warning (non-blocking):', result.audit_warning);
      }

      await Swal.fire('Berhasil', 'Status distribusi tugas pengganti diperbarui.', 'success');
    } catch (error) {
      await Swal.fire('Gagal update distribusi', error.message, 'error');
    } finally {
      setDeliveringTaskId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-40">
        <Loader2 className="mb-4 animate-spin text-blue-600" size={40} />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Sinkronisasi Control Room...</p>
      </div>
    );
  }

  return (
    <PageContainer className="pb-20">
      <PageHeader className="text-left">
        <div className="text-left">
          <PageTitle className="text-3xl italic uppercase">Piket Control Room</PageTitle>
          <PageSubtitle className="mt-2">Live Monitoring Dashboard</PageSubtitle>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 md:w-auto">
          <div className="flex items-center gap-2 rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
            <Filter size={16} className="text-blue-600" />
            <select
              value={filterKelas}
              onChange={(event) => setFilterKelas(event.target.value)}
              className="w-full cursor-pointer bg-transparent text-[10px] font-black uppercase text-gray-700 outline-none"
            >
              <option value="Semua">SELURUH KELAS</option>
              {daftarKelas.map((kelas) => (
                <option key={kelas.id} value={kelas.id}>
                  KELAS: {kelas.nama_kelas}
                </option>
              ))}
            </select>
          </div>
          <input
            type="date"
            value={tanggal}
            onChange={(event) => setTanggal(event.target.value)}
            className="rounded-2xl border border-gray-100 bg-white px-4 py-3 text-[10px] font-black uppercase text-gray-700 shadow-sm outline-none"
          />
        </div>
      </PageHeader>

      <div className="mb-8 grid grid-cols-2 gap-4 text-gray-800 md:grid-cols-6">
        <div className="flex flex-col items-center rounded-[28px] bg-blue-600 p-6 text-white shadow-lg">
          <Users size={20} className="mb-2 opacity-50" />
          <h2 className="text-3xl font-black">{stats.totalSiswa}</h2>
          <p className="text-[9px] font-black uppercase tracking-widest opacity-80">Total Siswa</p>
        </div>
        <Card className="rounded-[28px]">
          <CardContent className="flex flex-col items-center p-6">
            <CheckCircle size={20} className="mb-2 text-green-500" />
            <h2 className="text-3xl font-black">{stats.hadir}</h2>
            <p className="text-center text-[9px] font-black uppercase tracking-widest text-gray-400">Hadir</p>
          </CardContent>
        </Card>
        <Card className="rounded-[28px]">
          <CardContent className="flex flex-col items-center p-6">
            <Clock size={20} className="mb-2 text-amber-500" />
            <h2 className="text-3xl font-black">{stats.terlambat}</h2>
            <p className="text-center text-[9px] font-black uppercase tracking-widest text-gray-400">Telat</p>
          </CardContent>
        </Card>
        <Card className="rounded-[28px]">
          <CardContent className="flex flex-col items-center p-6">
            <Info size={20} className="mb-2 text-orange-500" />
            <h2 className="text-3xl font-black">{stats.sakit}</h2>
            <p className="text-center text-[9px] font-black uppercase tracking-widest text-gray-400">Sakit</p>
          </CardContent>
        </Card>
        <Card className="rounded-[28px]">
          <CardContent className="flex flex-col items-center p-6">
            <TrendingUp size={20} className="mb-2 text-blue-600" />
            <h2 className="text-3xl font-black">{stats.izin}</h2>
            <p className="text-center text-[9px] font-black uppercase tracking-widest text-gray-400">Izin</p>
          </CardContent>
        </Card>
        <div className="flex flex-col items-center rounded-[35px] bg-red-600 p-6 text-white shadow-lg">
          <AlertCircle size={20} className="mb-2 opacity-50" />
          <h2 className="text-3xl font-black">{stats.alpha}</h2>
          <p className="text-center text-[9px] font-black uppercase tracking-widest opacity-80">Alpha</p>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-8 md:grid-cols-3">
        <div className="flex h-[300px] flex-col items-center rounded-[40px] border border-gray-100 bg-white p-8 shadow-sm">
          <h3 className="mb-6 text-center text-[10px] font-black uppercase tracking-[0.2em] text-gray-800 italic">
            Komposisi Status
          </h3>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={chartData} innerRadius={60} outerRadius={80} dataKey="value" paddingAngle={5}>
                {chartData.map((entry, index) => (
                  <Cell key={index} fill={COLORS[entry.name]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: '20px', border: 'none', fontWeight: 'bold', fontSize: '10px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="text-left md:col-span-2 rounded-[40px] border border-gray-100 bg-white p-8 shadow-sm">
          <h3 className="mb-6 flex items-center gap-2 text-left text-[10px] font-black uppercase tracking-widest text-gray-400 italic">
            <Clock size={16} className="text-blue-600" /> Monitoring Kehadiran Kelas
          </h3>
          <div className="grid max-h-[200px] grid-cols-2 gap-3 overflow-y-auto pr-2 md:grid-cols-3">
            {monitoringKelas.map((kelas) => (
              <div
                key={kelas.id}
                className={`rounded-[25px] border p-4 text-left transition-all ${
                  kelas.isComplete ? 'border-green-100 bg-green-50' : 'border-red-100 bg-red-50'
                }`}
              >
                <p className="mb-1 truncate text-left text-[11px] font-black uppercase text-gray-800">{kelas.nama}</p>
                <p className="mb-1 truncate text-left text-[8px] font-black uppercase italic text-blue-500">{kelas.walas}</p>
                <p className="text-left text-[8px] font-bold uppercase text-gray-400">
                  {kelas.terabsen} / {kelas.total} Siswa
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="rounded-[32px]">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-600">EWS Guru Kosong (SLA 15 Menit)</h3>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-bold text-slate-600">
                {guruKosongSummary.warning} Warning
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] font-bold md:grid-cols-5">
              <div className="rounded-lg bg-slate-100 px-3 py-2 text-slate-700">Total: {guruKosongSummary.total}</div>
              <div className="rounded-lg bg-red-100 px-3 py-2 text-red-700">Warning: {guruKosongSummary.warning}</div>
              <div className="rounded-lg bg-emerald-100 px-3 py-2 text-emerald-700">Check-in: {guruKosongSummary.checkedIn}</div>
              <div className="rounded-lg bg-amber-100 px-3 py-2 text-amber-700">Tidak Masuk: {guruKosongSummary.absent}</div>
              <div className="rounded-lg bg-blue-100 px-3 py-2 text-blue-700">Dalam SLA: {guruKosongSummary.onWindow}</div>
            </div>
            <div className="max-h-[260px] space-y-2 overflow-y-auto pr-1">
              {!guruKosongRows.length && (
                <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500">
                  Tidak ada jadwal mapel pada tanggal ini.
                </p>
              )}
              {guruKosongRows.map((row) => (
                <div key={row.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-700">
                      {row.kelas_nama} • {row.mapel_nama}
                    </p>
                    <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${EWS_BADGE[row.type] || EWS_BADGE.on_window}`}>
                      {EWS_LABEL[row.type] || row.type}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {row.guru_nama} • {String(row.jam_mulai || '').slice(0, 5)}-{String(row.jam_selesai || '').slice(0, 5)}
                  </p>
                  <p className="text-[11px] font-medium text-slate-700">{row.warning_label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[32px]">
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black uppercase tracking-widest text-slate-600">Distribusi Tugas Pengganti</h3>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-bold text-amber-700">
                Pending: {absenceTasks.filter((item) => !item.delivered_by_picket).length}
              </span>
            </div>
            <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
              {!absenceTasks.length && (
                <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-500">
                  Belum ada tugas pengganti pada tanggal ini.
                </p>
              )}
              {absenceTasks.map((task) => (
                <div key={task.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-slate-700">
                        {task.kelas_nama} • {task.mapel_nama} • {task.jam_label}
                      </p>
                      <p className="text-[11px] text-slate-500">{task.guru_nama}</p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                        task.delivered_by_picket
                          ? 'border border-emerald-200 bg-emerald-100 text-emerald-700'
                          : 'border border-amber-200 bg-amber-100 text-amber-700'
                      }`}
                    >
                      {task.delivered_by_picket ? 'Delivered' : 'Pending'}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[11px] text-slate-600">{task.instruksi || '-'}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {task.file_path && (
                      <a
                        href={task.file_path}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-semibold text-blue-700 underline"
                      >
                        Buka Lampiran
                      </a>
                    )}
                    {!task.delivered_by_picket && (
                      <button
                        onClick={() => handleMarkDelivered(task.id)}
                        disabled={deliveringTaskId === task.id}
                        className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-[11px] font-bold text-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deliveringTaskId === task.id ? 'Memproses...' : 'Tandai Delivered'}
                      </button>
                    )}
                    {task.delivered_by_picket && task.delivered_at && (
                      <span className="text-[11px] text-emerald-700">
                        {new Date(task.delivered_at).toLocaleString('id-ID')}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-[45px] bg-gray-900 p-8 text-left text-white shadow-2xl">
        <header className="mb-8 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-left text-[10px] font-black uppercase tracking-widest text-blue-400 italic">
            <Printer size={16} /> Aktivitas Meja Piket
          </h3>
          <span className="rounded-full bg-white/10 px-3 py-1 text-[8px] font-bold uppercase italic">Update Real-Time</span>
        </header>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          {recentLogs.length === 0 ? (
            <div className="col-span-5 p-10 text-center text-[10px] font-bold uppercase tracking-widest text-gray-500 italic">
              Tidak ada aktivitas piket untuk hari ini
            </div>
          ) : (
            recentLogs.map((log) => (
              <div
                key={log.id}
                className="group flex flex-col justify-between rounded-[30px] border border-white/10 bg-white/5 p-5 transition-all hover:bg-white/10"
              >
                <div className="text-left">
                  <p className="mb-1 truncate text-left text-[10px] font-black uppercase leading-tight text-white">{log.siswa_nama}</p>
                  <p className="text-left text-[8px] font-bold uppercase italic text-blue-400">{log.jenis_log}</p>
                </div>
                <div className="mt-4 flex items-end justify-between border-t border-white/5 pt-4">
                  <div>
                    <p className="text-[8px] font-black uppercase text-gray-500">
                      {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <p className="text-[7px] font-bold uppercase italic text-gray-600">{log.siswa_kelas}</p>
                  </div>
                  <CheckCircle size={12} className="text-blue-500 opacity-50 transition-opacity group-hover:opacity-100" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </PageContainer>
  );
};

export default PiketDashboard;
