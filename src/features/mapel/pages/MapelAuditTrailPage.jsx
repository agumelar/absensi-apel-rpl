import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';

import {
  fetchMapelAuditFilterOptions,
  fetchMapelAuditTrail,
  MAPEL_AUDIT_ACTION,
  searchMapelAuditActors,
} from '../../../services/mapelService';
import { exportJsonToExcel } from '../../../services/shared/excelService';
import { formatDateToWIB, getTodayDateWIB } from '../../../services/shared/dateService';
import Button from '../../../shared/ui/Button';
import Card, { CardContent } from '../../../shared/ui/Card';
import { PageContainer, PageHeader, PageSubtitle, PageTitle } from '../../../shared/ui/PageLayout';

const ACTION_OPTIONS = [
  { value: 'all', label: 'Semua Aksi' },
  { value: MAPEL_AUDIT_ACTION.AGENDA_SUBMIT, label: 'Agenda Submit' },
  { value: MAPEL_AUDIT_ACTION.SESSION_CHECK_IN, label: 'Check-In' },
  { value: MAPEL_AUDIT_ACTION.SESSION_CHECK_OUT, label: 'Check-Out' },
  { value: MAPEL_AUDIT_ACTION.ATTENDANCE_MANUAL_SAVE, label: 'Simpan Absensi Manual' },
  { value: MAPEL_AUDIT_ACTION.TASK_DELIVERED_BY_PICKET, label: 'Distribusi Tugas Piket' },
];

const humanizeAction = (actionType) => {
  const found = ACTION_OPTIONS.find((item) => item.value === actionType);
  return found?.label ?? actionType;
};

const getToday = () => getTodayDateWIB();
const toISODate = (dateObj) => formatDateToWIB(dateObj);

const MapelAuditTrailPage = () => {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [kelasOptions, setKelasOptions] = useState([]);
  const [mapelOptions, setMapelOptions] = useState([]);
  const [actorOptions, setActorOptions] = useState([]);
  const [actorSearchTerm, setActorSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalRows, setTotalRows] = useState(0);
  const [filters, setFilters] = useState({
    fromDate: getToday(),
    toDate: getToday(),
    actionType: 'all',
    actorId: '',
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
      const data = await fetchMapelAuditTrail({
        fromDate: filters.fromDate,
        toDate: filters.toDate,
        actionType: filters.actionType,
        actorId: filters.actorId || undefined,
        kelasId: filters.kelasId !== 'all' ? filters.kelasId : undefined,
        mapelId: filters.mapelId !== 'all' ? filters.mapelId : undefined,
        page,
        pageSize,
      });
      setRows(data.rows || []);
      setTotalRows(data.total || 0);
    } catch (error) {
      Swal.fire('Gagal', error.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [filters.actionType, filters.actorId, filters.fromDate, filters.kelasId, filters.mapelId, filters.toDate, page, pageSize]);

  useEffect(() => {
    loadFilterOptions();
  }, [loadFilterOptions]);

  useEffect(() => {
    loadAuditRows();
  }, [loadAuditRows]);

  useEffect(() => {
    const run = async () => {
      try {
        const options = await searchMapelAuditActors({
          searchTerm: actorSearchTerm,
          limit: 30,
        });
        setActorOptions(options);
      } catch (error) {
        Swal.fire('Gagal', error.message, 'error');
      }
    };
    run();
  }, [actorSearchTerm]);

  const summary = useMemo(() => {
    const counters = {
      total: rows.length,
      agenda: 0,
      checkIn: 0,
      checkOut: 0,
      manual: 0,
      delivery: 0,
    };

    rows.forEach((row) => {
      if (row.action_type === MAPEL_AUDIT_ACTION.AGENDA_SUBMIT) counters.agenda += 1;
      if (row.action_type === MAPEL_AUDIT_ACTION.SESSION_CHECK_IN) counters.checkIn += 1;
      if (row.action_type === MAPEL_AUDIT_ACTION.SESSION_CHECK_OUT) counters.checkOut += 1;
      if (row.action_type === MAPEL_AUDIT_ACTION.ATTENDANCE_MANUAL_SAVE) counters.manual += 1;
      if (row.action_type === MAPEL_AUDIT_ACTION.TASK_DELIVERED_BY_PICKET) counters.delivery += 1;
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
      const firstPage = await fetchMapelAuditTrail({
        fromDate: filters.fromDate,
        toDate: filters.toDate,
        actionType: filters.actionType,
        actorId: filters.actorId || undefined,
        kelasId: filters.kelasId !== 'all' ? filters.kelasId : undefined,
        mapelId: filters.mapelId !== 'all' ? filters.mapelId : undefined,
        page: 1,
        pageSize: exportPageSize,
      });

      let exportRows = [...(firstPage.rows || [])];
      for (let currentPage = 2; currentPage <= firstPage.totalPages; currentPage += 1) {
        const nextPageData = await fetchMapelAuditTrail({
          fromDate: filters.fromDate,
          toDate: filters.toDate,
          actionType: filters.actionType,
          actorId: filters.actorId || undefined,
          kelasId: filters.kelasId !== 'all' ? filters.kelasId : undefined,
          mapelId: filters.mapelId !== 'all' ? filters.mapelId : undefined,
          page: currentPage,
          pageSize: exportPageSize,
        });
        exportRows = exportRows.concat(nextPageData.rows || []);
      }

      const excelRows = exportRows.map((row) => ({
        'Waktu Log': new Date(row.created_at).toLocaleString('id-ID'),
        'Tanggal Sesi': row.session_tanggal || '-',
        'Status Sesi': row.session_status || '-',
        Aksi: humanizeAction(row.action_type),
        'Actor ID': row.actor_id || '-',
        'Actor Nama': row.actor_name || '-',
        'Actor Role': row.actor_role || '-',
        Kelas: row.kelas_nama || '-',
        Mapel: row.mapel_nama || '-',
        'Kode Mapel': row.mapel_kode || '-',
        Jam: row.jam_label || '-',
        Metadata: JSON.stringify(row.metadata || {}),
      }));

      const fromLabel = filters.fromDate || 'all';
      const toLabel = filters.toDate || 'all';
      await exportJsonToExcel({
        rows: excelRows,
        sheetName: 'Audit Mapel',
        fileName: `Audit_Mapel_${fromLabel}_${toLabel}.xlsx`,
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
        <PageSubtitle className="mt-2 normal-case tracking-wide text-slate-500">Monitoring aksi guru mapel untuk kebutuhan kurikulum dan audit operasional.</PageSubtitle>
      </PageHeader>

      <Card className="rounded-2xl">
        <CardContent className="grid grid-cols-1 md:grid-cols-8 gap-2 p-4 md:p-5">
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
          Aksi
          <select
            value={filters.actionType}
            onChange={(e) => {
              setFilters((prev) => ({ ...prev, actionType: e.target.value }));
              setPage(1);
            }}
            className="w-full mt-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2"
          >
            {ACTION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-bold text-gray-600">
          Cari Guru (nama/ID)
          <input
            type="text"
            value={actorSearchTerm}
            onChange={(e) => {
              setActorSearchTerm(e.target.value);
            }}
            placeholder="Ketik nama atau actor ID"
            className="w-full mt-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2"
          />
        </label>
        <label className="text-xs font-bold text-gray-600">
          Actor (Filter)
          <select
            value={filters.actorId || 'all'}
            onChange={(e) => {
              const nextValue = e.target.value;
              setFilters((prev) => ({ ...prev, actorId: nextValue === 'all' ? '' : nextValue }));
              setPage(1);
            }}
            className="w-full mt-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2"
          >
            <option value="all">Semua Guru</option>
            {actorOptions.map((actor) => (
              <option key={actor.actor_id} value={actor.actor_id}>
                {actor.actor_name} ({actor.actor_role})
              </option>
            ))}
          </select>
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
          <Button
            onClick={loadAuditRows}
            disabled={loading}
            className="w-full text-xs uppercase tracking-wide"
            size="sm"
          >
            {loading ? 'Memuat...' : 'Refresh Audit'}
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
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
        <p className="text-xs text-gray-500">
          Total data filter: <span className="font-black text-gray-700">{totalRows}</span>
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-xs">
        <div className="rounded-lg bg-slate-100 px-3 py-2 font-bold text-slate-700">Total: {summary.total}</div>
        <div className="rounded-lg bg-indigo-50 px-3 py-2 font-bold text-indigo-700">Agenda: {summary.agenda}</div>
        <div className="rounded-lg bg-green-50 px-3 py-2 font-bold text-green-700">Check-In: {summary.checkIn}</div>
        <div className="rounded-lg bg-orange-50 px-3 py-2 font-bold text-orange-700">Check-Out: {summary.checkOut}</div>
        <div className="rounded-lg bg-blue-50 px-3 py-2 font-bold text-blue-700">Manual: {summary.manual}</div>
        <div className="rounded-lg bg-amber-50 px-3 py-2 font-bold text-amber-700">Delivery: {summary.delivery}</div>
      </div>

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

      <div className="flex justify-end">
        <Button
          onClick={handleExportExcel}
          disabled={loading || rows.length === 0}
          size="sm"
          className="bg-emerald-600 border-emerald-600 hover:bg-emerald-700 text-xs uppercase tracking-wide"
        >
          Export Excel (.xlsx)
        </Button>
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

        <div className="space-y-2">
          {rows.map((row) => (
            <article key={row.id} className="border border-gray-100 rounded-xl p-3 bg-gray-50">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-black text-gray-900">{humanizeAction(row.action_type)}</p>
                <p className="text-xs text-gray-500">{new Date(row.created_at).toLocaleString('id-ID')}</p>
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Actor: <span className="font-semibold">{row.actor_name || row.actor_id}</span> ({row.actor_role})
              </p>
              <p className="text-xs text-gray-600 mt-1">
                Kelas: <span className="font-semibold">{row.kelas_nama}</span> • Mapel:{' '}
                <span className="font-semibold">{row.mapel_nama}</span> • Jam:{' '}
                <span className="font-semibold">{row.jam_label}</span> • Tanggal Sesi:{' '}
                <span className="font-semibold">{row.session_tanggal || '-'}</span>
              </p>
              <pre className="mt-2 text-[11px] bg-white border border-gray-200 rounded-lg p-2 overflow-x-auto text-gray-700">
                {JSON.stringify(row.metadata || {}, null, 2)}
              </pre>
            </article>
          ))}
        </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
};

export default MapelAuditTrailPage;
