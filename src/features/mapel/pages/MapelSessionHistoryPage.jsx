import React, { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';

import {
  fetchMapelRecapFilterOptions,
  fetchClassAgendaBySession,
  fetchSessionsByDateRange,
  fetchStudentAttendanceBySession,
  fetchTeacherAbsenceTaskBySession,
} from '../../../services/mapelService';
import { exportMapelSessionHistoryToExcel } from '../../../services/shared/excelService';
import { getDateDaysAgoWIB, getTodayDateWIB } from '../../../services/shared/dateService';
import Button from '../../../shared/ui/Button';
import Card, { CardContent, CardHeader, CardTitle } from '../../../shared/ui/Card';
import { PageContainer, PageHeader, PageSubtitle, PageTitle } from '../../../shared/ui/PageLayout';
import {
  buildMonthRangeByOffset,
  buildSessionHistoryExcelRows,
  resolveTaskDeliverySummary,
} from '../utils/sessionHistoryRules';

const getToday = () => getTodayDateWIB();
const getLast7DaysDate = () => getDateDaysAgoWIB(6);

const MapelSessionHistoryPage = ({ user }) => {
  const [fromDate, setFromDate] = useState(getLast7DaysDate());
  const [toDate, setToDate] = useState(getToday());
  const [kelasOptions, setKelasOptions] = useState([]);
  const [selectedKelasId, setSelectedKelasId] = useState('');
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasAppliedFilter, setHasAppliedFilter] = useState(false);
  const [rows, setRows] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState(null);

  const selectedKelasLabel = useMemo(() => {
    if (!selectedKelasId) return 'Semua Kelas';
    const found = kelasOptions.find((item) => String(item.id) === String(selectedKelasId));
    return found?.nama_kelas || 'Semua Kelas';
  }, [kelasOptions, selectedKelasId]);

  const summary = useMemo(() => {
    const acc = { total: rows.length, hadir: 0, tidakMasuk: 0, pending: 0 };
    rows.forEach((row) => {
      const status = String(row.status || '').toLowerCase();
      if (status === 'hadir') acc.hadir += 1;
      else if (status === 'tidak_masuk' || status === 'tidak masuk' || status === 'absent') acc.tidakMasuk += 1;
      else acc.pending += 1;
    });
    return acc;
  }, [rows]);

  const loadRows = async () => {
    try {
      setLoading(true);
      const data = await fetchSessionsByDateRange({ fromDate, toDate, kelasId: selectedKelasId || undefined });
      setRows(data);
    } catch (error) {
      Swal.fire('Gagal', error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadKelasOptions = async () => {
      if (!user?.id) return;

      try {
        setLoadingFilters(true);
        const options = await fetchMapelRecapFilterOptions({ guruId: user.id });
        setKelasOptions(options.kelasOptions || []);
      } catch (error) {
        Swal.fire('Gagal', error.message, 'error');
      } finally {
        setLoadingFilters(false);
      }
    };

    loadKelasOptions();
  }, [user?.id]);

  const applyCurrentMonth = () => {
    const range = buildMonthRangeByOffset(getToday(), 0);
    setFromDate(range.fromDate);
    setToDate(range.toDate);
  };

  const applyPreviousMonth = () => {
    const range = buildMonthRangeByOffset(getToday(), -1);
    setFromDate(range.fromDate);
    setToDate(range.toDate);
  };

  const handleDownloadExcel = async () => {
    if (!rows.length) {
      Swal.fire('Tidak ada data', 'Tidak ada sesi pada filter aktif.', 'info');
      return;
    }

    await exportMapelSessionHistoryToExcel({
      meta: {
        kelasLabel: selectedKelasLabel,
        periodeLabel: `${fromDate} s/d ${toDate}`,
        totalSesiLabel: rows.length,
      },
      rows: buildSessionHistoryExcelRows(rows),
      fileName: `Riwayat_Sesi_${selectedKelasId || 'semua-kelas'}_${fromDate}_${toDate}.xlsx`
        .replace(/\s+/g, '_')
        .replace(/[^A-Za-z0-9_.-]/g, ''),
    });
  };

  const handleApplyFilter = async () => {
    await loadRows();
    setHasAppliedFilter(true);
    setDetail(null);
  };

  const openDetail = async (sessionRow) => {
    try {
      setDetailLoading(true);
      const [agenda, attendanceRows, absenceTask] = await Promise.all([
        fetchClassAgendaBySession(sessionRow.id),
        fetchStudentAttendanceBySession(sessionRow.id),
        fetchTeacherAbsenceTaskBySession(sessionRow.id),
      ]);

      const attendanceSummary = attendanceRows.reduce(
        (acc, item) => {
          const key = String(item.status || '').toUpperCase();
          if (key === 'HADIR' || key === 'H') acc.H += 1;
          if (key === 'SAKIT' || key === 'S') acc.S += 1;
          if (key === 'IZIN' || key === 'I') acc.I += 1;
          if (key === 'ALPHA' || key === 'A') acc.A += 1;
          return acc;
        },
        { H: 0, S: 0, I: 0, A: 0 },
      );

      setDetail({
        session: sessionRow,
        agenda,
        attendanceSummary,
        attendanceCount: attendanceRows.length,
        absenceTask,
      });
    } catch (error) {
      Swal.fire('Gagal', error.message, 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <PageContainer className="space-y-5">
      <PageHeader className="block">
        <PageTitle className="text-2xl md:text-3xl">Riwayat Sesi Mapel</PageTitle>
        <PageSubtitle className="mt-2 normal-case tracking-wide text-slate-500">
          Pantau check-in/out, agenda, dan ringkasan absensi lintas tanggal.
        </PageSubtitle>
      </PageHeader>

      <Card>
        <CardContent className="space-y-3 p-5 md:p-6">
          <div className="grid gap-3 md:grid-cols-4">
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Kelas</span>
            <select
              value={selectedKelasId}
              onChange={(event) => setSelectedKelasId(event.target.value)}
              disabled={loadingFilters}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">Semua Kelas</option>
              {kelasOptions.map((kelas) => (
                <option key={kelas.id} value={kelas.id}>
                  {kelas.nama_kelas}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dari</span>
            <input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sampai</span>
            <input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <div className="flex items-end">
            <Button onClick={handleApplyFilter} disabled={loading}>
              {loading ? 'Memuat...' : 'Terapkan Filter'}
            </Button>
          </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => { setFromDate(getLast7DaysDate()); setToDate(getToday()); }}>
              7 Hari Terakhir
            </Button>
            <Button variant="secondary" onClick={applyCurrentMonth}>
              Bulan Ini
            </Button>
            <Button variant="secondary" onClick={applyPreviousMonth}>
              Bulan Lalu
            </Button>
            <Button
              variant="secondary"
              onClick={handleDownloadExcel}
              disabled={loading || !hasAppliedFilter || rows.length === 0}
            >
              Download Excel Riwayat
            </Button>
          </div>

          <p className="text-xs text-slate-500">1) Pilih filter 2) Terapkan Filter 3) Download Excel</p>
        </CardContent>
      </Card>

      <div className="grid gap-2 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-xs text-slate-500">Total Sesi</p>
          <p className="text-lg font-bold text-slate-800">{summary.total}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-blue-50 px-3 py-2">
          <p className="text-xs text-slate-500">Status Hadir</p>
          <p className="text-lg font-bold text-blue-700">{summary.hadir}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-rose-50 px-3 py-2">
          <p className="text-xs text-slate-500">Tidak Masuk</p>
          <p className="text-lg font-bold text-rose-700">{summary.tidakMasuk}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-amber-50 px-3 py-2">
          <p className="text-xs text-slate-500">Pending/Lainnya</p>
          <p className="text-lg font-bold text-amber-700">{summary.pending}</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Daftar Sesi</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="premium-table min-w-full text-sm">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left">Tanggal</th>
                  <th className="px-3 py-2 text-left">Kelas</th>
                  <th className="px-3 py-2 text-left">Mapel</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Topik</th>
                  <th className="px-3 py-2 text-left">Metode</th>
                  <th className="px-3 py-2 text-left">H/S/I/A</th>
                  <th className="px-3 py-2 text-left">Status Distribusi Tugas</th>
                  <th className="px-3 py-2 text-left">Waktu Distribusi</th>
                  <th className="px-3 py-2 text-left">Check-In</th>
                  <th className="px-3 py-2 text-left">Check-Out</th>
                  <th className="px-3 py-2 text-left">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const attendanceSummary = (row.student_attendance_mapel || []).reduce(
                    (acc, item) => {
                      const key = String(item.status || '').toUpperCase();
                      if (key === 'HADIR' || key === 'H') acc.H += 1;
                      if (key === 'SAKIT' || key === 'S') acc.S += 1;
                      if (key === 'IZIN' || key === 'I') acc.I += 1;
                      if (key === 'ALPHA' || key === 'A') acc.A += 1;
                      return acc;
                    },
                    { H: 0, S: 0, I: 0, A: 0 },
                  );
                  const taskDelivery = resolveTaskDeliverySummary(row);
                  const deliveryBadgeClass =
                    taskDelivery.deliveryStatusLabel === 'Sudah Didistribusikan'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : taskDelivery.deliveryStatusLabel === 'Menunggu Distribusi'
                        ? 'border-amber-200 bg-amber-50 text-amber-700'
                        : 'border-slate-200 bg-slate-50 text-slate-600';

                  return (
                    <tr key={row.id}>
                      <td className="px-3 py-2">{row.tanggal || '-'}</td>
                      <td className="px-3 py-2">{row.schedule?.master_kelas?.nama_kelas || '-'}</td>
                      <td className="px-3 py-2">{row.schedule?.master_mapel?.nama_mapel || '-'}</td>
                      <td className="px-3 py-2">{row.status || '-'}</td>
                      <td className="px-3 py-2">{row.class_agenda?.[0]?.topik || '-'}</td>
                      <td className="px-3 py-2">{row.class_agenda?.[0]?.metode || '-'}</td>
                      <td className="px-3 py-2">{`H:${attendanceSummary.H} S:${attendanceSummary.S} I:${attendanceSummary.I} A:${attendanceSummary.A}`}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${deliveryBadgeClass}`}
                        >
                          {taskDelivery.deliveryStatusLabel}
                        </span>
                      </td>
                      <td className="px-3 py-2">{taskDelivery.deliveryTimeLabel}</td>
                      <td className="px-3 py-2">
                        {row.waktu_check_in ? new Date(row.waktu_check_in).toLocaleTimeString('id-ID') : '-'}
                      </td>
                      <td className="px-3 py-2">
                        {row.waktu_check_out ? new Date(row.waktu_check_out).toLocaleTimeString('id-ID') : '-'}
                      </td>
                      <td className="px-3 py-2">
                        <Button variant="secondary" size="sm" onClick={() => openDetail(row)} disabled={detailLoading}>
                          Detail
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {!rows.length && (
                  <tr>
                    <td colSpan={12} className="px-3 py-4 text-center text-slate-500">
                      Belum ada sesi pada rentang tanggal ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {detail && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Detail Sesi: {detail.session.schedule?.master_mapel?.nama_mapel || '-'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="font-semibold text-slate-700">Agenda</p>
              <p className="text-slate-600">Topik: {detail.agenda?.topik || '-'}</p>
              <p className="text-slate-600">Metode: {detail.agenda?.metode || '-'}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="font-semibold text-slate-700">Ringkasan Absensi ({detail.attendanceCount} siswa)</p>
              <p className="text-slate-600">
                H: {detail.attendanceSummary.H} | S: {detail.attendanceSummary.S} | I: {detail.attendanceSummary.I} | A: {detail.attendanceSummary.A}
              </p>
            </div>
            {detail.absenceTask && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
                <p className="font-semibold text-rose-700">Tugas Pengganti (Guru Tidak Masuk)</p>
                <p className="text-rose-700">{detail.absenceTask.instruksi || '-'}</p>
                {detail.absenceTask.file_path && (
                  <a className="mt-2 inline-block text-sm font-semibold text-blue-700 underline" href={detail.absenceTask.file_path} target="_blank" rel="noreferrer">
                    Buka Lampiran
                  </a>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
};

export default MapelSessionHistoryPage;
