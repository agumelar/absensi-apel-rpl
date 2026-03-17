import React, { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';

import {
  fetchClassAgendaBySession,
  fetchSessionsByDateRange,
  fetchStudentAttendanceBySession,
  fetchTeacherAbsenceTaskBySession,
} from '../../../services/mapelService';
import Button from '../../../shared/ui/Button';
import Card, { CardContent, CardHeader, CardTitle } from '../../../shared/ui/Card';
import { PageContainer, PageHeader, PageSubtitle, PageTitle } from '../../../shared/ui/PageLayout';

const getToday = () => new Date().toISOString().slice(0, 10);

const getLast7DaysDate = () => {
  const date = new Date();
  date.setDate(date.getDate() - 6);
  return date.toISOString().slice(0, 10);
};

const MapelSessionHistoryPage = () => {
  const [fromDate, setFromDate] = useState(getLast7DaysDate());
  const [toDate, setToDate] = useState(getToday());
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState(null);

  const summary = useMemo(() => {
    const acc = { total: rows.length, hadir: 0, tidakMasuk: 0, pending: 0 };
    rows.forEach((row) => {
      const status = String(row.status || '').toLowerCase();
      if (status === 'hadir') acc.hadir += 1;
      else if (status === 'tidak_masuk') acc.tidakMasuk += 1;
      else acc.pending += 1;
    });
    return acc;
  }, [rows]);

  const loadRows = async () => {
    try {
      setLoading(true);
      const data = await fetchSessionsByDateRange({ fromDate, toDate });
      setRows(data);
    } catch (error) {
      Swal.fire('Gagal', error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          if (key === 'HADIR') acc.H += 1;
          if (key === 'SAKIT') acc.S += 1;
          if (key === 'IZIN') acc.I += 1;
          if (key === 'ALPHA') acc.A += 1;
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
        <CardContent className="grid gap-3 p-5 md:grid-cols-4 md:p-6">
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
          <div className="md:col-span-2 flex items-end gap-2">
            <Button onClick={loadRows} disabled={loading}>
              {loading ? 'Memuat...' : 'Muat Riwayat'}
            </Button>
            <Button variant="secondary" onClick={() => { setFromDate(getLast7DaysDate()); setToDate(getToday()); }}>
              7 Hari Terakhir
            </Button>
          </div>
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
                  <th className="px-3 py-2 text-left">Check-In</th>
                  <th className="px-3 py-2 text-left">Check-Out</th>
                  <th className="px-3 py-2 text-left">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2">{row.tanggal || '-'}</td>
                    <td className="px-3 py-2">{row.schedule?.master_kelas?.nama_kelas || '-'}</td>
                    <td className="px-3 py-2">{row.schedule?.master_mapel?.nama_mapel || '-'}</td>
                    <td className="px-3 py-2">{row.status || '-'}</td>
                    <td className="px-3 py-2">{row.waktu_check_in ? new Date(row.waktu_check_in).toLocaleTimeString('id-ID') : '-'}</td>
                    <td className="px-3 py-2">{row.waktu_check_out ? new Date(row.waktu_check_out).toLocaleTimeString('id-ID') : '-'}</td>
                    <td className="px-3 py-2">
                      <Button variant="secondary" size="sm" onClick={() => openDetail(row)} disabled={detailLoading}>
                        Detail
                      </Button>
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={7} className="px-3 py-4 text-center text-slate-500">
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
