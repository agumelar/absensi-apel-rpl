import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';

import {
  fetchExecutiveMapelKpiDataset,
  fetchMapelAuditFilterOptions,
  fetchMapelAuditSessionSummary,
} from '../../../services/mapelService';
import { exportMapelAuditSessionSummaryToExcel } from '../../../services/shared/excelService';
import { formatDateToWIB, getTodayDateWIB } from '../../../services/shared/dateService';
import Button from '../../../shared/ui/Button';
import Card, { CardContent } from '../../../shared/ui/Card';
import { PageContainer, PageHeader, PageSubtitle, PageTitle } from '../../../shared/ui/PageLayout';

const getToday = () => getTodayDateWIB();
const toISODate = (dateObj) => formatDateToWIB(dateObj);

const normalizeSessionStatus = (status) => String(status || '').trim().toLowerCase();

const isTidakMasukStatus = (status) => {
  const normalized = normalizeSessionStatus(status);
  return normalized === 'tidak masuk' || normalized === 'tidak_masuk' || normalized === 'absent';
};

const humanizeSessionStatus = (status) => {
  const normalized = normalizeSessionStatus(status);
  if (normalized === 'hadir') return 'Hadir';
  if (normalized === 'pending') return 'Pending';
  if (isTidakMasukStatus(status)) return 'Tidak Masuk';
  if (normalized === 'checked_in') return 'Checked-In';
  if (normalized === 'checked_out') return 'Checked-Out';
  if (normalized === 'completed') return 'Completed';
  if (normalized === 'teaching') return 'Teaching';
  if (normalized === 'scheduled') return 'Scheduled';
  return status || '-';
};

const formatDateTimeLabel = (value) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString('id-ID');
};

const MapelAuditTrailPage = () => {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [kelasOptions, setKelasOptions] = useState([]);
  const [mapelOptions, setMapelOptions] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalRows, setTotalRows] = useState(0);
  const [kpiContext, setKpiContext] = useState(null);
  const [filters, setFilters] = useState({
    fromDate: getToday(),
    toDate: getToday(),
    kelasId: 'all',
    mapelId: 'all',
  });

  const loadFilterOptions = useCallback(async () => {
    try {
      const options = await fetchMapelAuditFilterOptions();
      setKelasOptions(options.kelasOptions || []);
      setMapelOptions(options.mapelOptions || []);
    } catch (error) {
      Swal.fire('Gagal', error.message, 'error');
    }
  }, []);

  const loadAuditRows = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchMapelAuditSessionSummary({
        fromDate: filters.fromDate,
        toDate: filters.toDate,
        kelasId: filters.kelasId !== 'all' ? filters.kelasId : undefined,
        mapelId: filters.mapelId !== 'all' ? filters.mapelId : undefined,
        page,
        pageSize,
      });
      setRows(data.rows || []);
      setTotalRows(data.total || 0);

      const kpiData = await fetchExecutiveMapelKpiDataset({
        fromDate: filters.fromDate,
        toDate: filters.toDate,
        kelasId: filters.kelasId !== 'all' ? Number(filters.kelasId) : undefined,
        mapelId: filters.mapelId !== 'all' ? Number(filters.mapelId) : undefined,
        trendBy: 'kelas_nama',
      });
      setKpiContext(kpiData.summary || null);
    } catch (error) {
      Swal.fire('Gagal', error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [filters.fromDate, filters.kelasId, filters.mapelId, filters.toDate, page, pageSize]);

  useEffect(() => {
    loadFilterOptions();
  }, [loadFilterOptions]);

  useEffect(() => {
    loadAuditRows();
  }, [loadAuditRows]);

  const summary = useMemo(() => {
    const counters = {
      total: rows.length,
      tidakMasuk: 0,
      hadir: 0,
      pending: 0,
      siswaHadir: 0,
      siswaSakit: 0,
      siswaIzin: 0,
      siswaAlpha: 0,
    };

    rows.forEach((row) => {
      const status = normalizeSessionStatus(row.status);
      if (isTidakMasukStatus(status)) counters.tidakMasuk += 1;
      else if (status === 'pending' || status === 'scheduled') counters.pending += 1;
      else counters.hadir += 1;

      counters.siswaHadir += Number(row.attendance_summary?.hadir || 0);
      counters.siswaSakit += Number(row.attendance_summary?.sakit || 0);
      counters.siswaIzin += Number(row.attendance_summary?.izin || 0);
      counters.siswaAlpha += Number(row.attendance_summary?.alpha || 0);
    });
    return counters;
  }, [rows]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalRows / pageSize)), [pageSize, totalRows]);

  const handleExportExcel = async () => {
    if (totalRows === 0) {
      Swal.fire('Tidak ada data', 'Tidak ada data audit untuk diexport.', 'info');
      return;
    }

    try {
      setLoading(true);
      const exportPageSize = 100;
      const firstPage = await fetchMapelAuditSessionSummary({
        fromDate: filters.fromDate,
        toDate: filters.toDate,
        kelasId: filters.kelasId !== 'all' ? filters.kelasId : undefined,
        mapelId: filters.mapelId !== 'all' ? filters.mapelId : undefined,
        page: 1,
        pageSize: exportPageSize,
      });

      let exportRows = [...(firstPage.rows || [])];
      for (let currentPage = 2; currentPage <= firstPage.totalPages; currentPage += 1) {
        const nextPageData = await fetchMapelAuditSessionSummary({
          fromDate: filters.fromDate,
          toDate: filters.toDate,
          kelasId: filters.kelasId !== 'all' ? filters.kelasId : undefined,
          mapelId: filters.mapelId !== 'all' ? filters.mapelId : undefined,
          page: currentPage,
          pageSize: exportPageSize,
        });
        exportRows = exportRows.concat(nextPageData.rows || []);
      }

      const selectedKelasLabel =
        filters.kelasId === 'all' ? 'Semua Kelas' : kelasOptions.find((item) => String(item.id) === String(filters.kelasId))?.nama_kelas || '-';
      const selectedMapelLabel =
        filters.mapelId === 'all' ? 'Semua Mapel' : mapelOptions.find((item) => String(item.id) === String(filters.mapelId))?.nama_mapel || '-';

      await exportMapelAuditSessionSummaryToExcel({
        meta: {
          periodeLabel: `${filters.fromDate || '-'} s/d ${filters.toDate || '-'}`,
          kelasLabel: selectedKelasLabel,
          mapelLabel: selectedMapelLabel,
        },
        summary: {
          presenceRate: kpiContext?.presenceRate || 0,
          lateRate: kpiContext?.lateRate || 0,
          tidakMasukRate: kpiContext?.tidakMasukRate || 0,
          slaBreachRate: kpiContext?.slaBreachRate || 0,
        },
        rows: exportRows,
        fileName: `Audit_Mapel_${filters.fromDate || 'all'}_${filters.toDate || 'all'}.xlsx`,
      });
    } catch (error) {
      Swal.fire('Gagal export', error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const applyDatePreset = (daysBack) => {
    const todayDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(todayDate.getDate() - daysBack);
    setFilters((prev) => ({
      ...prev,
      fromDate: toISODate(fromDate),
      toDate: toISODate(todayDate),
    }));
    setPage(1);
  };

  return (
    <PageContainer className="space-y-5">
      <PageHeader className="block">
        <PageTitle className="text-2xl md:text-3xl">Audit Trail Mapel</PageTitle>
        <PageSubtitle className="mt-2 normal-case tracking-wide text-slate-500">
          Ringkasan sesi per guru: kelas, mapel, jam, check-in/out, agenda, dan rekap absensi siswa.
        </PageSubtitle>
      </PageHeader>

      <Card className="rounded-2xl">
        <CardContent className="grid grid-cols-1 gap-2 p-4 md:grid-cols-6 md:p-5">
          <label className="text-xs font-bold text-gray-600">
            Dari Tanggal
            <input
              type="date"
              value={filters.fromDate}
              onChange={(e) => {
                setFilters((prev) => ({ ...prev, fromDate: e.target.value }));
                setPage(1);
              }}
              className="w-full mt-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2"
            />
          </label>
          <label className="text-xs font-bold text-gray-600">
            Sampai Tanggal
            <input
              type="date"
              value={filters.toDate}
              onChange={(e) => {
                setFilters((prev) => ({ ...prev, toDate: e.target.value }));
                setPage(1);
              }}
              className="w-full mt-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2"
            />
          </label>
          <label className="text-xs font-bold text-gray-600">
            Kelas
            <select
              value={filters.kelasId}
              onChange={(e) => {
                setFilters((prev) => ({ ...prev, kelasId: e.target.value }));
                setPage(1);
              }}
              className="w-full mt-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2"
            >
              <option value="all">Semua Kelas</option>
              {kelasOptions.map((kelas) => (
                <option key={kelas.id} value={kelas.id}>
                  {kelas.nama_kelas}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold text-gray-600">
            Mapel
            <select
              value={filters.mapelId}
              onChange={(e) => {
                setFilters((prev) => ({ ...prev, mapelId: e.target.value }));
                setPage(1);
              }}
              className="w-full mt-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2"
            >
              <option value="all">Semua Mapel</option>
              {mapelOptions.map((mapel) => (
                <option key={mapel.id} value={mapel.id}>
                  {mapel.nama_mapel}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <Button onClick={loadAuditRows} disabled={loading} className="w-full text-xs uppercase tracking-wide" size="sm">
              {loading ? 'Memuat...' : 'Refresh Audit'}
            </Button>
          </div>
          <div className="flex items-end">
            <Button
              onClick={handleExportExcel}
              disabled={loading || rows.length === 0}
              size="sm"
              className="w-full bg-emerald-600 border-emerald-600 hover:bg-emerald-700 text-xs uppercase tracking-wide"
            >
              Export Excel
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-600">Baris / halaman</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs font-semibold"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
        <p className="text-xs text-gray-500">
          Total sesi sesuai filter: <span className="font-black text-gray-700">{totalRows}</span>
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-7 gap-2 text-xs">
        <div className="rounded-lg bg-slate-100 px-3 py-2 font-bold text-slate-700">Sesi: {summary.total}</div>
        <div className="rounded-lg bg-green-50 px-3 py-2 font-bold text-green-700">Hadir: {summary.hadir}</div>
        <div className="rounded-lg bg-rose-50 px-3 py-2 font-bold text-rose-700">Tidak Masuk: {summary.tidakMasuk}</div>
        <div className="rounded-lg bg-amber-50 px-3 py-2 font-bold text-amber-700">Pending: {summary.pending}</div>
        <div className="rounded-lg bg-blue-50 px-3 py-2 font-bold text-blue-700">Siswa Hadir: {summary.siswaHadir}</div>
        <div className="rounded-lg bg-orange-50 px-3 py-2 font-bold text-orange-700">Siswa Sakit/Izin: {summary.siswaSakit + summary.siswaIzin}</div>
        <div className="rounded-lg bg-red-50 px-3 py-2 font-bold text-red-700">Siswa Alpha: {summary.siswaAlpha}</div>
      </div>

      {kpiContext && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <span className="rounded-full bg-slate-100 px-3 py-1 font-bold text-slate-700">
              Scope: {kpiContext.roleScope === 'jurusan' ? 'Jurusan (Kaprog)' : 'Global Executive'}
            </span>
            <span className="rounded-full bg-amber-50 px-3 py-1 font-bold text-amber-700">
              Alert SLA: {Number(kpiContext.slaBreachRate || 0) > 0 ? 'Aktif' : 'Normal'}
            </span>
            <span className="rounded-full bg-sky-50 px-3 py-1 font-bold text-sky-700">
              Total Sesi KPI: {kpiContext.totalSessions || 0}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-green-100 bg-green-50 px-3 py-3">
              <p className="text-xs text-slate-500">Presence Rate</p>
              <p className="text-2xl font-black text-green-700">{kpiContext.presenceRate || 0}%</p>
            </div>
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-3">
              <p className="text-xs text-slate-500">Late Rate</p>
              <p className="text-2xl font-black text-amber-700">{kpiContext.lateRate || 0}%</p>
            </div>
            <div className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-3">
              <p className="text-xs text-slate-500">Tidak Masuk Rate</p>
              <p className="text-2xl font-black text-rose-700">{kpiContext.tidakMasukRate || 0}%</p>
            </div>
            <div className="rounded-xl border border-orange-100 bg-orange-50 px-3 py-3">
              <p className="text-xs text-slate-500">SLA Breach Rate</p>
              <p className="text-2xl font-black text-orange-700">{kpiContext.slaBreachRate || 0}%</p>
            </div>
            <div className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-3">
              <p className="text-xs text-slate-500">Kelas Terdampak</p>
              <p className="text-2xl font-black text-sky-700">{kpiContext.impactedClasses || 0}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="text-xs text-slate-500">Total Sesi KPI</p>
              <p className="text-2xl font-black text-slate-700">{kpiContext.totalSessions || 0}</p>
            </div>
          </div>
        </>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => applyDatePreset(0)}
          className="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 font-black text-[11px] uppercase tracking-wide"
        >
          Hari Ini
        </button>
        <button
          onClick={() => applyDatePreset(6)}
          className="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 font-black text-[11px] uppercase tracking-wide"
        >
          7 Hari
        </button>
        <button
          onClick={() => applyDatePreset(29)}
          className="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 font-black text-[11px] uppercase tracking-wide"
        >
          30 Hari
        </button>
      </div>

      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          disabled={loading || page <= 1}
          className="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 font-black text-[11px] uppercase tracking-wide disabled:opacity-50"
        >
          Prev
        </button>
        <p className="text-xs font-bold text-gray-600">
          Halaman {page} / {totalPages}
        </p>
        <button
          onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
          disabled={loading || page >= totalPages}
          className="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 font-black text-[11px] uppercase tracking-wide disabled:opacity-50"
        >
          Next
        </button>
      </div>

      <Card className="rounded-2xl">
        <CardContent className="p-3 md:p-4">
          {loading && (
            <div className="p-6 text-center">
              <span className="micro-loading">Memuat audit trail...</span>
            </div>
          )}
          {rows.length === 0 && !loading && (
            <p className="text-sm text-gray-500 p-6">Belum ada data audit untuk filter saat ini.</p>
          )}

          <div className="space-y-3">
            {rows.map((row) => (
              <article key={row.id} className="border border-gray-100 rounded-xl p-4 bg-gray-50">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-black text-gray-900">
                      {row.guru_nama} • {row.mapel_nama}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      {row.kelas_nama} • {row.hari} • {row.jam_label} • Tanggal: {row.tanggal || '-'}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-[10px] font-bold ${
                      isTidakMasukStatus(row.status)
                        ? 'bg-rose-100 text-rose-700'
                        : normalizeSessionStatus(row.status) === 'pending'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {humanizeSessionStatus(row.status)}
                  </span>
                </div>

                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700">
                    <p>
                      <span className="font-semibold">Check-In:</span> {formatDateTimeLabel(row.waktu_check_in)}
                    </p>
                    <p className="mt-1">
                      <span className="font-semibold">Bukti:</span>{' '}
                      {row.foto_check_in ? (
                        <a href={row.foto_check_in} target="_blank" rel="noreferrer" className="text-blue-700 underline">
                          Lihat foto check-in
                        </a>
                      ) : (
                        'Belum ada'
                      )}
                    </p>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700">
                    <p>
                      <span className="font-semibold">Check-Out:</span> {formatDateTimeLabel(row.waktu_check_out)}
                    </p>
                    <p className="mt-1">
                      <span className="font-semibold">Bukti:</span>{' '}
                      {row.foto_check_out ? (
                        <a href={row.foto_check_out} target="_blank" rel="noreferrer" className="text-blue-700 underline">
                          Lihat foto check-out
                        </a>
                      ) : (
                        'Belum ada'
                      )}
                    </p>
                  </div>
                </div>

                <div className="mt-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700">
                  <p>
                    <span className="font-semibold">Agenda:</span> {row.agenda_topik || '-'}
                  </p>
                  <p className="mt-1">
                    <span className="font-semibold">Metode:</span> {row.agenda_metode || '-'}
                  </p>
                </div>

                <div className="mt-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700">
                  <p className="font-semibold">Rekap Absensi Siswa</p>
                  <p className="mt-1">
                    Hadir: <span className="font-bold">{row.attendance_summary?.hadir || 0}</span> • Sakit:{' '}
                    <span className="font-bold">{row.attendance_summary?.sakit || 0}</span> • Izin:{' '}
                    <span className="font-bold">{row.attendance_summary?.izin || 0}</span> • Alpha:{' '}
                    <span className="font-bold">{row.attendance_summary?.alpha || 0}</span>
                  </p>
                </div>

                {isTidakMasukStatus(row.status) && (
                  <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    <p className="font-semibold">Guru Tidak Masuk</p>
                    <p className="mt-1">
                      <span className="font-semibold">Alasan / Instruksi:</span> {row.absence_task?.instruksi || 'Belum diisi'}
                    </p>
                    <p className="mt-1">
                      <span className="font-semibold">Lampiran Tugas:</span>{' '}
                      {row.absence_task?.file_path ? (
                        <a
                          href={row.absence_task.file_path}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-700 underline"
                        >
                          Buka lampiran
                        </a>
                      ) : (
                        'Tidak ada'
                      )}
                    </p>
                  </div>
                )}
              </article>
            ))}
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
};

export default MapelAuditTrailPage;
