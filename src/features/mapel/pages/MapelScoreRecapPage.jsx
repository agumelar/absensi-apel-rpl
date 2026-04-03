import React, { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';

import {
  fetchMapelRecapFilterOptions,
  fetchMapelScoreRecap,
} from '../../../services/mapelService';
import { exportMapelScoreRecapToExcel } from '../../../services/shared/excelService';
import Button from '../../../shared/ui/Button';
import Card, { CardContent, CardHeader, CardTitle } from '../../../shared/ui/Card';
import { PageContainer, PageHeader, PageSubtitle, PageTitle } from '../../../shared/ui/PageLayout';
import {
  buildRecapRequestPeriod,
  buildScoreRecapExcelDataRows,
  formatRecapPeriodLabel,
} from '../utils/scoreRecapRules';
import { getTodayDateWIB } from '../../../services/shared/dateService';

const PERIOD_MODE_OPTIONS = [
  { value: 'today', label: 'Hari Ini' },
  { value: 'monthly', label: 'Bulanan' },
  { value: 'range', label: 'Rentang Tanggal' },
];

const MapelScoreRecapPage = ({ user }) => {
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
  const [recapPeriod, setRecapPeriod] = useState(null);
  const [recapRows, setRecapRows] = useState([]);
  const [recapSummary, setRecapSummary] = useState({
    totalSiswa: 0,
    siswaDinilai: 0,
    siswaBelumDinilai: 0,
    rataRataCoverage: 0,
  });
  const [totalPertemuan, setTotalPertemuan] = useState(0);

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

  const periodLabel = useMemo(() => formatRecapPeriodLabel(recapPeriod), [recapPeriod]);
  const activeKelasLabel = useMemo(() => {
    const found = kelasOptions.find((item) => String(item.id) === String(selectedKelasId));
    return found?.nama_kelas || '-';
  }, [kelasOptions, selectedKelasId]);
  const activeMapelLabel = useMemo(() => {
    const found = mapelOptions.find((item) => String(item.id) === String(selectedMapelId));
    if (!found) return '-';
    return found.kode_mapel ? `${found.nama_mapel} (${found.kode_mapel})` : found.nama_mapel;
  }, [mapelOptions, selectedMapelId]);

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

      const result = await fetchMapelScoreRecap({
        guruId: user.id,
        kelasId: selectedKelasId,
        mapelId: selectedMapelId,
        ...periodPayload,
      });

      setRecapRows(result.rows || []);
      setRecapSummary(
        result.summary || {
          totalSiswa: 0,
          siswaDinilai: 0,
          siswaBelumDinilai: 0,
          rataRataCoverage: 0,
        },
      );
      setTotalPertemuan(Number(result.totalPertemuan || 0));
      setRecapPeriod(result.period || null);
      setHasApplied(true);
    } catch (error) {
      Swal.fire('Gagal', error.message, 'error');
    } finally {
      setLoadingRecap(false);
    }
  };

  const handleDownloadExcel = async () => {
    if (!hasApplied || recapRows.length === 0) {
      Swal.fire('Tidak ada data', 'Terapkan filter dulu sebelum export.', 'info');
      return;
    }

    await exportMapelScoreRecapToExcel({
      meta: {
        kelasLabel: activeKelasLabel,
        mapelLabel: activeMapelLabel,
        periodeLabel: periodLabel,
        totalPertemuanLabel: totalPertemuan,
      },
      rows: buildScoreRecapExcelDataRows(recapRows),
      fileName: `Rekap_Penilaian_Keaktifan_${selectedKelasId || 'kelas'}_${selectedMapelId || 'mapel'}_${recapPeriod?.fromDate || 'from'}_${recapPeriod?.toDate || 'to'}.xlsx`
        .replace(/\s+/g, '_')
        .replace(/[^A-Za-z0-9_.-]/g, ''),
    });
  };

  const isInitialState = !hasApplied;

  return (
    <PageContainer className="space-y-5">
      <PageHeader className="block space-y-2">
        <PageTitle className="text-2xl md:text-3xl">Rekap Penilaian Keaktifan</PageTitle>
        <PageSubtitle className="normal-case tracking-wide text-slate-500">
          Rekap penilaian keaktifan siswa per kelas dan mapel untuk periode tertentu.
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

      {hasApplied && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Hasil Rekap</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 md:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs text-slate-500">Total Pertemuan</p>
                <p className="text-lg font-bold text-slate-800">{totalPertemuan}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs text-slate-500">Siswa Dinilai</p>
                <p className="text-lg font-bold text-slate-800">
                  {recapSummary.siswaDinilai}/{recapSummary.totalSiswa}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs text-slate-500">Belum Dinilai</p>
                <p className="text-lg font-bold text-slate-800">{recapSummary.siswaBelumDinilai}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs text-slate-500">Rata-rata Cakupan Penilaian</p>
                <p className="text-lg font-bold text-slate-800">{recapSummary.rataRataCoverage}%</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 items-center justify-between">
              <p className="text-xs font-medium text-slate-500">Periode aktif: {periodLabel}</p>
              <Button onClick={handleDownloadExcel} disabled={loadingRecap || recapRows.length === 0}>
                Download Excel Rekap
              </Button>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="premium-table min-w-full text-sm">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left">Nama</th>
                    <th className="px-3 py-2 text-left">NIS</th>
                    <th className="px-3 py-2 text-right">Total Pertemuan</th>
                    <th className="px-3 py-2 text-right">Frekuensi Dinilai</th>
                    <th className="px-3 py-2 text-right">Cakupan Penilaian (%)</th>
                    <th className="px-3 py-2 text-right">Total Poin</th>
                    <th className="px-3 py-2 text-right">Rata-rata Saat Diberi Nilai</th>
                    <th className="px-3 py-2 text-left">Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  {recapRows.map((row) => (
                    <tr key={row.siswa_id}>
                      <td className="px-3 py-2 font-medium text-slate-800">{row.nama_siswa || '-'}</td>
                      <td className="px-3 py-2 text-slate-700">{row.nis || '-'}</td>
                      <td className="px-3 py-2 text-right font-semibold">{row.total_pertemuan}</td>
                      <td className="px-3 py-2 text-right font-semibold">{row.frekuensi_dinilai}</td>
                      <td className="px-3 py-2 text-right font-semibold">{row.coverage_persen}%</td>
                      <td className="px-3 py-2 text-right font-semibold">{row.total_poin}</td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {row.rata_rata_saat_dinilai === null ? '-' : row.rata_rata_saat_dinilai}
                      </td>
                      <td className="px-3 py-2 text-slate-700">{row.keterangan || '-'}</td>
                    </tr>
                  ))}
                  {recapRows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-5 text-center text-slate-500">
                        Tidak ada data penilaian untuk filter periode ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
};

export default MapelScoreRecapPage;
