import React, { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';

import {
  fetchMapelAttendanceRecap,
  fetchMapelRecapFilterOptions,
  fillMissingAttendanceForSession,
} from '../../../services/mapelService';
import { exportMapelRecapToExcel } from '../../../services/shared/excelService';
import { getTodayDateWIB } from '../../../services/shared/dateService';
import Card, { CardContent, CardHeader, CardTitle } from '../../../shared/ui/Card';
import { PageContainer, PageHeader, PageSubtitle, PageTitle } from '../../../shared/ui/PageLayout';
import Button from '../../../shared/ui/Button';
import {
  buildRecapExcelDataRows,
  buildRecapRequestPeriod,
  formatRecapPeriodLabel,
} from '../utils/attendanceRecapRules';

const PERIOD_MODE_OPTIONS = [
  { value: 'today', label: 'Hari Ini' },
  { value: 'monthly', label: 'Bulanan' },
  { value: 'range', label: 'Rentang Tanggal' },
];

const BACKFILL_STATUS_OPTIONS = [
  { value: 'H', label: 'H - Hadir' },
  { value: 'S', label: 'S - Sakit' },
  { value: 'I', label: 'I - Izin' },
  { value: 'A', label: 'A - Alpha' },
];

const INITIAL_RECAP_STATE = {
  period: null,
  postingDate: null,
  totalPertemuan: 0,
  rows: [],
  summary: {
    totalBelumDiisi: 0,
    isFinal: false,
    statusLabel: 'Belum Final',
  },
  missingEntries: [],
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';

  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  }).format(parsed);
};

const MapelAttendanceRecapPage = ({ user }) => {
  const today = useMemo(() => getTodayDateWIB(), []);
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [loadingRecap, setLoadingRecap] = useState(false);
  const [hasApplied, setHasApplied] = useState(false);
  const [kelasOptions, setKelasOptions] = useState([]);
  const [mapelOptions, setMapelOptions] = useState([]);
  const [selectedKelasId, setSelectedKelasId] = useState('');
  const [selectedMapelId, setSelectedMapelId] = useState('');
  const [periodMode, setPeriodMode] = useState('monthly');
  const [anchorDate, setAnchorDate] = useState(today);
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [recap, setRecap] = useState(INITIAL_RECAP_STATE);
  const [selectedMissingEntryKey, setSelectedMissingEntryKey] = useState('');
  const [selectedBackfillStatus, setSelectedBackfillStatus] = useState('H');
  const [submittingBackfill, setSubmittingBackfill] = useState(false);

  useEffect(() => {
    const loadFilterOptions = async () => {
      if (!user?.id) return;

      try {
        setLoadingFilters(true);
        const options = await fetchMapelRecapFilterOptions({ guruId: user.id });
        setKelasOptions(options.kelasOptions || []);
        setMapelOptions(options.mapelOptions || []);

        const firstKelas = options.kelasOptions?.[0]?.id;
        const firstMapel = options.mapelOptions?.[0]?.id;
        if (firstKelas !== undefined && firstKelas !== null) {
          setSelectedKelasId(String(firstKelas));
        }
        if (firstMapel !== undefined && firstMapel !== null) {
          setSelectedMapelId(String(firstMapel));
        }
      } catch (error) {
        Swal.fire('Gagal', error.message, 'error');
      } finally {
        setLoadingFilters(false);
      }
    };

    loadFilterOptions();
  }, [user?.id]);

  const periodLabel = useMemo(() => formatRecapPeriodLabel(recap.period), [recap.period]);
  const activeKelasLabel = useMemo(() => {
    const found = kelasOptions.find((item) => String(item.id) === String(selectedKelasId));
    return found?.nama_kelas || '-';
  }, [kelasOptions, selectedKelasId]);
  const activeMapelLabel = useMemo(() => {
    const found = mapelOptions.find((item) => String(item.id) === String(selectedMapelId));
    if (!found) return '-';
    return found.kode_mapel ? `${found.nama_mapel} (${found.kode_mapel})` : found.nama_mapel;
  }, [mapelOptions, selectedMapelId]);
  const selectedMissingEntry = useMemo(() => {
    if (!selectedMissingEntryKey) return null;
    return (
      recap.missingEntries.find(
        (entry) => `${entry.session_id}:${entry.siswa_id}` === selectedMissingEntryKey,
      ) || null
    );
  }, [recap.missingEntries, selectedMissingEntryKey]);

  const handleApply = async () => {
    if (!user?.id) {
      Swal.fire('Gagal', 'User tidak valid.', 'error');
      return;
    }

    if (!selectedKelasId || !selectedMapelId) {
      Swal.fire('Validasi', 'Kelas dan mapel wajib dipilih.', 'warning');
      return;
    }

    if (periodMode === 'range' && (!fromDate || !toDate)) {
      Swal.fire('Validasi', 'Dari/Sampai tanggal wajib diisi untuk mode rentang.', 'warning');
      return;
    }

    try {
      setLoadingRecap(true);
      const periodPayload = buildRecapRequestPeriod({
        mode: periodMode,
        anchorDate,
        fromDate,
        toDate,
      });

      const result = await fetchMapelAttendanceRecap({
        guruId: user.id,
        kelasId: selectedKelasId,
        mapelId: selectedMapelId,
        ...periodPayload,
      });

      setRecap({
        ...INITIAL_RECAP_STATE,
        ...result,
        summary: {
          ...INITIAL_RECAP_STATE.summary,
          ...(result.summary || {}),
        },
      });
      const firstMissing = result?.missingEntries?.[0];
      setSelectedMissingEntryKey(
        firstMissing ? `${firstMissing.session_id}:${firstMissing.siswa_id}` : '',
      );
      setHasApplied(true);
    } catch (error) {
      Swal.fire('Gagal', error.message, 'error');
    } finally {
      setLoadingRecap(false);
    }
  };

  const refreshRecap = async () => {
    const periodPayload = buildRecapRequestPeriod({
      mode: periodMode,
      anchorDate,
      fromDate,
      toDate,
    });

    const result = await fetchMapelAttendanceRecap({
      guruId: user.id,
      kelasId: selectedKelasId,
      mapelId: selectedMapelId,
      ...periodPayload,
    });

    setRecap({
      ...INITIAL_RECAP_STATE,
      ...result,
      summary: {
        ...INITIAL_RECAP_STATE.summary,
        ...(result.summary || {}),
      },
    });

    const firstMissing = result?.missingEntries?.[0];
    setSelectedMissingEntryKey(
      firstMissing ? `${firstMissing.session_id}:${firstMissing.siswa_id}` : '',
    );
  };

  const handleBackfill = async () => {
    if (!selectedMissingEntry) {
      Swal.fire('Validasi', 'Pilih sesi+siswa yang ingin diperbaiki.', 'warning');
      return;
    }

    try {
      setSubmittingBackfill(true);
      await fillMissingAttendanceForSession({
        sessionId: selectedMissingEntry.session_id,
        siswaId: selectedMissingEntry.siswa_id,
        status: selectedBackfillStatus,
        actorName: user?.nama_lengkap || user?.username || 'Guru Mapel',
      });

      await refreshRecap();
      Swal.fire('Berhasil', 'Data bolong berhasil diperbaiki.', 'success');
    } catch (error) {
      Swal.fire('Gagal', error.message, 'error');
    } finally {
      setSubmittingBackfill(false);
    }
  };

  const handleDownloadExcel = async () => {
    if (!hasApplied || recap.rows.length === 0) {
      Swal.fire('Tidak ada data', 'Terapkan filter dulu sebelum export.', 'info');
      return;
    }

    const exportRows = buildRecapExcelDataRows(recap.rows);

    await exportMapelRecapToExcel({
      meta: {
        mapelLabel: activeMapelLabel,
        kelasLabel: activeKelasLabel,
        periodeLabel: periodLabel,
        finalityLabel: recap.summary?.statusLabel || 'Belum Final',
      },
      rows: exportRows,
      fileName: `Rekap_KBM_${selectedKelasId || 'kelas'}_${selectedMapelId || 'mapel'}_${
        recap.period?.fromDate || 'from'
      }_${recap.period?.toDate || 'to'}.xlsx`,
    });
  };

  const isInitialState = !hasApplied;
  const isEmptyAfterApply = hasApplied && recap.totalPertemuan === 0;

  return (
    <PageContainer className="space-y-5">
      <PageHeader className="block space-y-2">
        <PageTitle className="text-2xl md:text-3xl">Rekap Kehadiran Mapel</PageTitle>
        <PageSubtitle className="normal-case tracking-wide text-slate-500">
          Rekap kehadiran siswa per kelas dan mapel untuk periode tertentu.
        </PageSubtitle>
      </PageHeader>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Filter Rekap</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Kelas</span>
              <select
                value={selectedKelasId}
                onChange={(event) => setSelectedKelasId(event.target.value)}
                disabled={loadingFilters}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              >
                {!kelasOptions.length && <option value="">Tidak ada kelas</option>}
                {kelasOptions.map((kelas) => (
                  <option key={kelas.id} value={kelas.id}>
                    {kelas.nama_kelas}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mapel</span>
              <select
                value={selectedMapelId}
                onChange={(event) => setSelectedMapelId(event.target.value)}
                disabled={loadingFilters}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              >
                {!mapelOptions.length && <option value="">Tidak ada mapel</option>}
                {mapelOptions.map((mapel) => (
                  <option key={mapel.id} value={mapel.id}>
                    {mapel.nama_mapel} ({mapel.kode_mapel || '-'})
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mode Periode</span>
              <select
                value={periodMode}
                onChange={(event) => setPeriodMode(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              >
                {PERIOD_MODE_OPTIONS.map((modeOption) => (
                  <option key={modeOption.value} value={modeOption.value}>
                    {modeOption.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-end">
              <Button onClick={handleApply} disabled={loadingFilters || loadingRecap || !selectedKelasId || !selectedMapelId}>
                {loadingRecap ? 'Memuat...' : 'Terapkan'}
              </Button>
            </div>
          </div>

          {periodMode === 'range' ? (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dari Tanggal</span>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(event) => setFromDate(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </label>
              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sampai Tanggal</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(event) => setToDate(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </label>
            </div>
          ) : (
            <label className="space-y-1 block max-w-sm">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {periodMode === 'today' ? 'Tanggal' : 'Tanggal Acuan'}
              </span>
              <input
                type="date"
                value={anchorDate}
                onChange={(event) => setAnchorDate(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </label>
          )}
        </CardContent>
      </Card>

      {isInitialState && (
        <Card>
          <CardContent className="p-8 text-center text-sm text-slate-600">
            Pilih filter lalu klik <span className="font-semibold">Terapkan</span> untuk menampilkan rekap.
          </CardContent>
        </Card>
      )}

      {isEmptyAfterApply && (
        <Card>
          <CardContent className="p-8 text-center text-sm text-slate-600">
            Tidak ada sesi pada filter dan periode yang dipilih.
          </CardContent>
        </Card>
      )}

      {hasApplied && recap.totalPertemuan > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Hasil Rekap</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recap.summary?.totalBelumDiisi > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                Peringatan: masih ada {recap.summary.totalBelumDiisi} data bolong. Rekap berstatus{' '}
                {recap.summary?.statusLabel || 'Belum Final'}.
              </div>
            )}

            <div className="grid gap-2 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs text-slate-500">Posting Terakhir</p>
                <p className="text-sm font-semibold text-slate-800">{formatDateTime(recap.postingDate)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs text-slate-500">Periode</p>
                <p className="text-sm font-semibold text-slate-800">{periodLabel}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs text-slate-500">Status Rekap</p>
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                    recap.summary?.isFinal
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {recap.summary?.statusLabel || 'Belum Final'}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleDownloadExcel} disabled={loadingRecap || recap.rows.length === 0}>
                Download Excel
              </Button>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Perbaikan Data Bolong</p>
              <div className="mt-2 grid gap-2 md:grid-cols-3">
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-slate-500">Sesi + Siswa</span>
                  <select
                    value={selectedMissingEntryKey}
                    onChange={(event) => setSelectedMissingEntryKey(event.target.value)}
                    disabled={recap.summary?.totalBelumDiisi === 0 || submittingBackfill}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  >
                    {recap.missingEntries.length === 0 && <option value="">Tidak ada data bolong</option>}
                    {recap.missingEntries.map((entry) => (
                      <option key={`${entry.session_id}:${entry.siswa_id}`} value={`${entry.session_id}:${entry.siswa_id}`}>
                        {entry.session_tanggal || '-'} - {entry.nama_siswa} ({entry.nis || '-'})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold text-slate-500">Status</span>
                  <select
                    value={selectedBackfillStatus}
                    onChange={(event) => setSelectedBackfillStatus(event.target.value)}
                    disabled={recap.summary?.totalBelumDiisi === 0 || submittingBackfill}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  >
                    {BACKFILL_STATUS_OPTIONS.map((statusOption) => (
                      <option key={statusOption.value} value={statusOption.value}>
                        {statusOption.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="flex items-end">
                  <Button
                    onClick={handleBackfill}
                    disabled={
                      submittingBackfill ||
                      recap.summary?.totalBelumDiisi === 0 ||
                      !selectedMissingEntryKey
                    }
                  >
                    {submittingBackfill ? 'Menyimpan...' : 'Perbaiki Data Bolong'}
                  </Button>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="premium-table min-w-full text-sm">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left">Nama</th>
                    <th className="px-3 py-2 text-left">NIS</th>
                    <th className="px-3 py-2 text-right">Total Pertemuan</th>
                    <th className="px-3 py-2 text-right">H</th>
                    <th className="px-3 py-2 text-right">S</th>
                    <th className="px-3 py-2 text-right">I</th>
                    <th className="px-3 py-2 text-right">A</th>
                    <th className="px-3 py-2 text-right">Belum diisi</th>
                    <th className="px-3 py-2 text-right">% Kehadiran</th>
                  </tr>
                </thead>
                <tbody>
                  {recap.rows.map((row) => (
                    <tr key={row.siswa_id}>
                      <td className="px-3 py-2 font-medium text-slate-800">{row.nama_siswa || '-'}</td>
                      <td className="px-3 py-2 text-slate-700">{row.nis || '-'}</td>
                      <td className="px-3 py-2 text-right font-semibold">{row.total_pertemuan}</td>
                      <td className="px-3 py-2 text-right text-emerald-700 font-semibold">{row.hadir}</td>
                      <td className="px-3 py-2 text-right text-amber-700 font-semibold">{row.sakit}</td>
                      <td className="px-3 py-2 text-right text-blue-700 font-semibold">{row.izin}</td>
                      <td className="px-3 py-2 text-right text-rose-700 font-semibold">{row.alpha}</td>
                      <td className="px-3 py-2 text-right font-semibold">{row.belum_diisi}</td>
                      <td className="px-3 py-2 text-right font-semibold">{row.persentase_kehadiran}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
};

export default MapelAttendanceRecapPage;
