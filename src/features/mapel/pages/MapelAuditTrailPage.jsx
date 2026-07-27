import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Download,
  FileSearch,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
} from 'lucide-react';

import {
  fetchMapelAuditFilterOptions,
  fetchMapelAuditSessionSummary,
} from '../../../services/mapelService';
import { exportMapelAuditSessionSummaryToExcel } from '../../../services/shared/excelService';
import { getDateDaysAgoWIB, getTodayDateWIB } from '../../../services/shared/dateService';
import Button from '../../../shared/ui/Button';
import Card, { CardContent } from '../../../shared/ui/Card';
import { PageContainer, PageHeader, PageSubtitle, PageTitle } from '../../../shared/ui/PageLayout';

const formatDateTimeLabel = (value) => {
  if (!value) return 'Belum ada';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Belum ada';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const formatDateLabel = (value) => {
  if (!value) return '-';
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00+07:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

const formatTimeLabel = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
};

const formatRate = (value, denominator) => (Number(denominator || 0) > 0 ? `${Number(value || 0)}%` : '—');

const getStatusTone = (row) => {
  if (row.attention_type === 'lupa_absen') {
    return 'border-rose-200 bg-rose-100 text-rose-800 dark:border-rose-800 dark:bg-rose-950/70 dark:text-rose-300';
  }
  if (row.attention_type === 'confirmed_absence') {
    return 'border-orange-200 bg-orange-100 text-orange-800 dark:border-orange-800 dark:bg-orange-950/70 dark:text-orange-300';
  }
  if (row.attention_type === 'late') {
    return 'border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950/70 dark:text-amber-300';
  }
  if (row.attention_type === 'missing_checkout') {
    return 'border-violet-200 bg-violet-100 text-violet-800 dark:border-violet-800 dark:bg-violet-950/70 dark:text-violet-300';
  }
  if (['sla_breach', 'pending'].includes(row.attention_type)) {
    return 'border-yellow-200 bg-yellow-100 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950/70 dark:text-yellow-300';
  }
  return 'border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300';
};

const MapelAuditTrailPage = () => {
  const today = useMemo(() => getTodayDateWIB(), []);
  const [filters, setFilters] = useState({
    fromDate: getDateDaysAgoWIB(6),
    toDate: today,
    kelasId: 'all',
    mapelId: 'all',
    attentionType: 'all',
  });
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [kelasOptions, setKelasOptions] = useState([]);
  const [mapelOptions, setMapelOptions] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalRows, setTotalRows] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

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
        attentionType: filters.attentionType,
        page,
        pageSize,
      });
      setRows(data.rows || []);
      setSummary(data.summary || null);
      setTotalRows(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      Swal.fire('Gagal', error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [filters, page, pageSize]);

  useEffect(() => {
    loadFilterOptions();
  }, [loadFilterOptions]);

  useEffect(() => {
    loadAuditRows();
  }, [loadAuditRows]);

  const applyDatePreset = (daysAgo) => {
    setFilters((prev) => ({
      ...prev,
      fromDate: getDateDaysAgoWIB(daysAgo),
      toDate: today,
    }));
    setPage(1);
  };

  const handleExportExcel = async () => {
    if (totalRows === 0) {
      Swal.fire('Tidak ada data', 'Tidak ada riwayat pembelajaran untuk diekspor.', 'info');
      return;
    }

    try {
      setExporting(true);
      const request = {
        fromDate: filters.fromDate,
        toDate: filters.toDate,
        kelasId: filters.kelasId !== 'all' ? filters.kelasId : undefined,
        mapelId: filters.mapelId !== 'all' ? filters.mapelId : undefined,
        attentionType: filters.attentionType,
        pageSize: 200,
      };
      const firstPage = await fetchMapelAuditSessionSummary({ ...request, page: 1 });
      let exportRows = [...(firstPage.rows || [])];
      for (let currentPage = 2; currentPage <= firstPage.totalPages; currentPage += 1) {
        const nextPage = await fetchMapelAuditSessionSummary({ ...request, page: currentPage });
        exportRows = exportRows.concat(nextPage.rows || []);
      }

      const kelasLabel =
        filters.kelasId === 'all'
          ? 'Semua Kelas'
          : kelasOptions.find((item) => String(item.id) === String(filters.kelasId))?.nama_kelas || '-';
      const mapelLabel =
        filters.mapelId === 'all'
          ? 'Semua Mapel'
          : mapelOptions.find((item) => String(item.id) === String(filters.mapelId))?.nama_mapel || '-';

      await exportMapelAuditSessionSummaryToExcel({
        meta: {
          periodeLabel: `${firstPage.summary?.fromDate || filters.fromDate} s/d ${firstPage.summary?.toDate || filters.toDate}`,
          kelasLabel,
          mapelLabel,
          holidayPolicyLabel: 'Monitoring mulai 20 Juli 2026; hari libur dan jadwal yang belum dimulai tidak dihitung',
        },
        summary: firstPage.summary || summary || {},
        rows: exportRows,
        fileName: `Riwayat_Mapel_${filters.fromDate}_${filters.toDate}.xlsx`,
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
        <PageTitle className="text-2xl md:text-3xl">Riwayat & Bukti Pembelajaran</PageTitle>
        <PageSubtitle className="mt-2 normal-case tracking-wide text-slate-500">
          Audit per jadwal: termasuk sesi yang terlaksana, terlambat, tidak lengkap, dan jadwal yang berakhir tanpa absensi guru.
        </PageSubtitle>
      </PageHeader>

      <Card className="rounded-2xl">
        <CardContent className="grid grid-cols-1 gap-3 p-5 md:grid-cols-6">
          <label className="text-xs font-bold text-slate-600">
            Dari Tanggal
            <input
              type="date"
              value={filters.fromDate}
              onChange={(event) => {
                setFilters((prev) => ({ ...prev, fromDate: event.target.value }));
                setPage(1);
              }}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
            />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Sampai Tanggal
            <input
              type="date"
              value={filters.toDate}
              onChange={(event) => {
                setFilters((prev) => ({ ...prev, toDate: event.target.value }));
                setPage(1);
              }}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
            />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Kelas
            <select
              value={filters.kelasId}
              onChange={(event) => {
                setFilters((prev) => ({ ...prev, kelasId: event.target.value }));
                setPage(1);
              }}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
            >
              <option value="all">Semua Kelas</option>
              {kelasOptions.map((kelas) => (
                <option key={kelas.id} value={kelas.id}>{kelas.nama_kelas}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600">
            Mata Pelajaran
            <select
              value={filters.mapelId}
              onChange={(event) => {
                setFilters((prev) => ({ ...prev, mapelId: event.target.value }));
                setPage(1);
              }}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
            >
              <option value="all">Semua Mapel</option>
              {mapelOptions.map((mapel) => (
                <option key={mapel.id} value={mapel.id}>{mapel.nama_mapel}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-600">
            Status Perhatian
            <select
              value={filters.attentionType}
              onChange={(event) => {
                setFilters((prev) => ({ ...prev, attentionType: event.target.value }));
                setPage(1);
              }}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
            >
              <option value="all">Semua Status</option>
              <option value="lupa_absen">Lupa Absen</option>
              <option value="confirmed_absence">Tidak Masuk Terkonfirmasi</option>
              <option value="late">Terlambat</option>
              <option value="missing_checkout">Belum Check-out</option>
              <option value="sla_breach">Belum Check-in &gt;15 Menit</option>
              <option value="complete">Lengkap / Tepat Waktu</option>
            </select>
          </label>
          <div className="flex items-end gap-2">
            <Button onClick={loadAuditRows} disabled={loading} className="w-full text-xs uppercase" size="sm">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Muat
            </Button>
            <Button
              onClick={handleExportExcel}
              disabled={loading || exporting || totalRows === 0}
              size="sm"
              className="w-full bg-emerald-600 text-xs uppercase hover:bg-emerald-700"
            >
              <Download size={14} /> {exporting ? 'Proses' : 'Excel'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => applyDatePreset(0)} className="rounded-lg bg-slate-100 px-3 py-2 text-[11px] font-black uppercase text-slate-700">
            Hari Ini
          </button>
          <button onClick={() => applyDatePreset(6)} className="rounded-lg bg-slate-100 px-3 py-2 text-[11px] font-black uppercase text-slate-700">
            7 Hari
          </button>
          <button onClick={() => applyDatePreset(29)} className="rounded-lg bg-slate-100 px-3 py-2 text-[11px] font-black uppercase text-slate-700">
            30 Hari
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Periode efektif {summary?.fromDate || filters.fromDate} s/d {summary?.toDate || filters.toDate} •{' '}
          <span className="font-black text-slate-800">{totalRows}</span> jadwal ditemukan
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <div className="rounded-xl border border-sky-100 bg-sky-50 p-3 dark:border-sky-900/70 dark:bg-sky-950/40">
          <div className="flex items-center justify-between text-sky-700 dark:text-sky-300"><span className="text-[11px] font-bold">HASIL FILTER</span><CalendarDays size={16} /></div>
          <p className="mt-1 text-xl font-black text-sky-800 dark:text-sky-200">{summary?.totalScheduled || 0}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Kehadiran {formatRate(summary?.presenceRate, summary?.totalScheduled)}</p>
        </div>
        <div className="rounded-xl border border-rose-100 bg-rose-50 p-3 dark:border-rose-900/70 dark:bg-rose-950/40">
          <div className="flex items-center justify-between text-rose-700 dark:text-rose-300"><span className="text-[11px] font-bold">LUPA ABSEN</span><AlertTriangle size={16} /></div>
          <p className="mt-1 text-xl font-black text-rose-800 dark:text-rose-200">{summary?.totalLupaAbsen || 0}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Jadwal selesai tanpa sesi</p>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-3 dark:border-amber-900/70 dark:bg-amber-950/40">
          <div className="flex items-center justify-between text-amber-700 dark:text-amber-300"><span className="text-[11px] font-bold">TERLAMBAT</span><Clock3 size={16} /></div>
          <p className="mt-1 text-xl font-black text-amber-800 dark:text-amber-200">{summary?.totalLate || 0}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{formatRate(summary?.lateRate, summary?.totalHadir)} dari sesi hadir</p>
        </div>
        <div className="rounded-xl border border-violet-100 bg-violet-50 p-3 dark:border-violet-900/70 dark:bg-violet-950/40">
          <div className="flex items-center justify-between text-violet-700 dark:text-violet-300"><span className="text-[11px] font-bold">BELUM CHECK-OUT</span><FileSearch size={16} /></div>
          <p className="mt-1 text-xl font-black text-violet-800 dark:text-violet-200">{summary?.totalMissingCheckOut || 0}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Sesi perlu dilengkapi</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="text-xs font-bold text-slate-600">
          Baris per halaman
          <select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
            className="ml-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </label>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={loading || page <= 1}
            className="rounded-lg bg-slate-100 px-3 py-2 text-[11px] font-black uppercase text-slate-700 disabled:opacity-40"
          >
            Sebelumnya
          </button>
          <p className="text-xs font-bold text-slate-600">Halaman {page} / {totalPages}</p>
          <button
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={loading || page >= totalPages}
            className="rounded-lg bg-slate-100 px-3 py-2 text-[11px] font-black uppercase text-slate-700 disabled:opacity-40"
          >
            Berikutnya
          </button>
        </div>
      </div>

      <Card className="rounded-2xl">
        <CardContent className="p-3 md:p-4">
          {loading && (
            <div className="p-10 text-center">
              <Loader2 className="mx-auto animate-spin text-blue-600" size={26} />
              <p className="mt-2 text-xs text-slate-500">Memuat riwayat pembelajaran...</p>
            </div>
          )}
          {!loading && rows.length === 0 && (
            <div className="p-10 text-center">
              <CheckCircle2 className="mx-auto text-slate-300" size={32} />
              <p className="mt-3 text-sm font-bold text-slate-700">Tidak ada data sesuai filter</p>
              <p className="mt-1 text-xs text-slate-500">Coba ubah rentang tanggal atau status perhatian.</p>
            </div>
          )}

          {!loading && (
            <div className="space-y-3">
              {rows.map((row) => (
                <article
                  key={row.id}
                  className={`rounded-xl border px-4 py-3 ${
                    row.is_virtual
                      ? 'border-rose-200 bg-rose-50/70 dark:border-rose-900/70 dark:bg-rose-950/20'
                      : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/70'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-900 dark:text-slate-100">
                        {row.guru_nama} <span className="font-bold text-slate-500 dark:text-slate-400">• {row.mapel_nama}</span>
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                        {row.kelas_nama} • {row.jam_label} • {formatDateLabel(row.tanggal)}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black ${getStatusTone(row)}`}>
                      {row.status}
                    </span>
                  </div>

                  {row.is_virtual ? (
                    <p className="mt-2 border-t border-rose-200/80 pt-2 text-xs text-rose-700 dark:border-rose-900/70 dark:text-rose-300">
                      Tidak ada sesi atau check-in setelah jadwal selesai. Catatan dibuat otomatis dari jadwal.
                    </p>
                  ) : (
                    <>
                      <div className="mt-3 grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2 xl:grid-cols-4 dark:border-slate-800">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Waktu aktual</p>
                          <p className="mt-1 text-xs font-bold text-slate-700 dark:text-slate-200">
                            IN {formatTimeLabel(row.waktu_check_in)} <span className="text-slate-300 dark:text-slate-600">•</span> OUT {formatTimeLabel(row.waktu_check_out)}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Agenda</p>
                          <p className="mt-1 truncate text-xs font-bold text-slate-700 dark:text-slate-200" title={row.agenda_topik || 'Belum diisi'}>
                            {row.agenda_topik || 'Belum diisi'}
                          </p>
                          <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
                            {row.agenda_metode ? `Metode: ${row.agenda_metode}` : 'Metode belum diisi'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Absensi siswa</p>
                          <div className="mt-1 flex flex-wrap gap-1 text-[10px] font-black">
                            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300">H {row.attendance_summary?.hadir || 0}</span>
                            <span className="rounded bg-sky-100 px-1.5 py-0.5 text-sky-700 dark:bg-sky-950/70 dark:text-sky-300">S {row.attendance_summary?.sakit || 0}</span>
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300">I {row.attendance_summary?.izin || 0}</span>
                            <span className="rounded bg-rose-100 px-1.5 py-0.5 text-rose-700 dark:bg-rose-950/70 dark:text-rose-300">A {row.attendance_summary?.alpha || 0}</span>
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">Bukti foto</p>
                          <p className="mt-1 flex items-center gap-2 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                            <ImageIcon size={13} />
                            IN {row.foto_check_in ? 'Ada' : '—'} • OUT {row.foto_check_out ? 'Ada' : '—'}
                          </p>
                        </div>
                      </div>

                      <details className="group mt-3 border-t border-slate-100 pt-2 dark:border-slate-800">
                        <summary className="flex cursor-pointer list-none items-center justify-between text-[11px] font-black text-blue-700 dark:text-blue-300">
                          <span>Foto & detail lengkap</span>
                          <ChevronDown size={15} className="transition-transform group-open:rotate-180" />
                        </summary>
                        <div className="mt-3 grid gap-3 md:grid-cols-2">
                          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-300">
                            <p className="font-black text-slate-900 dark:text-slate-100">Check-in</p>
                            <p className="mt-1">{formatDateTimeLabel(row.waktu_check_in)}</p>
                            {row.foto_check_in ? (
                              <a href={row.foto_check_in} target="_blank" rel="noreferrer" className="mt-2 inline-block font-bold text-blue-700 underline dark:text-blue-300">Lihat bukti foto</a>
                            ) : (
                              <p className="mt-2 text-slate-400">Bukti foto tidak tersedia</p>
                            )}
                          </div>
                          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-950/50 dark:text-slate-300">
                            <p className="font-black text-slate-900 dark:text-slate-100">Check-out</p>
                            <p className="mt-1">{formatDateTimeLabel(row.waktu_check_out)}</p>
                            {row.foto_check_out ? (
                              <a href={row.foto_check_out} target="_blank" rel="noreferrer" className="mt-2 inline-block font-bold text-blue-700 underline dark:text-blue-300">Lihat bukti foto</a>
                            ) : (
                              <p className="mt-2 text-slate-400">Bukti foto tidak tersedia</p>
                            )}
                          </div>
                          {row.attention_type === 'confirmed_absence' && (
                            <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-xs text-orange-800 md:col-span-2 dark:border-orange-900/70 dark:bg-orange-950/30 dark:text-orange-300">
                              <p className="font-black">Tidak Masuk Terkonfirmasi</p>
                              <p className="mt-1">Alasan / instruksi: {row.absence_task?.instruksi || 'Belum diisi'}</p>
                              {row.absence_task?.file_path && (
                                <a href={row.absence_task.file_path} target="_blank" rel="noreferrer" className="mt-1 inline-block font-bold text-blue-700 underline dark:text-blue-300">
                                  Buka lampiran tugas
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      </details>
                    </>
                  )}
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
};

export default MapelAuditTrailPage;
