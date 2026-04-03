import React, { useEffect, useMemo, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import { Save } from 'lucide-react';

import {
  fetchDailyScoreBySession,
  fetchMapelRecapFilterOptions,
  fetchMapelScoreRecap,
  fetchSessionsByTanggal,
} from '../../../services/mapelService';
import { exportMapelScoreRecapToExcel } from '../../../services/shared/excelService';
import { fetchActiveStudentsByKelas } from '../../../services/absensiService';
import {
  flushMapelSyncQueue,
  getMapelSyncQueueSummary,
  saveBulkDailyScoreWithOfflineFallback,
  saveDailyScoreWithOfflineFallback,
} from '../../../services/mapelSyncQueueService';
import { getTodayDateWIB } from '../../../services/shared/dateService';
import Button from '../../../shared/ui/Button';
import Card, { CardContent, CardHeader, CardTitle } from '../../../shared/ui/Card';
import { PageContainer, PageHeader, PageSubtitle, PageTitle } from '../../../shared/ui/PageLayout';
import {
  buildScoreRecapExcelDataRows,
  buildRecapRequestPeriod,
  formatRecapPeriodLabel,
} from '../utils/scoreRecapRules';

const SCORE_MIN = 0;
const SCORE_MAX = 100;
const AUTOSAVE_DELAY_MS = 900;
const AUTOSAVE_STORAGE_KEY_PREFIX = 'mapel_score_autosave';
const SCORE_DRAFT_STORAGE_KEY_PREFIX = 'mapel_score_draft';
const PERIOD_MODE_OPTIONS = [
  { value: 'today', label: 'Hari Ini' },
  { value: 'monthly', label: 'Bulanan' },
  { value: 'range', label: 'Rentang Tanggal' },
];

const resolveAutosaveStorageKey = (userId) => `${AUTOSAVE_STORAGE_KEY_PREFIX}:${userId ?? 'anonymous'}`;
const resolveScoreDraftStorageKey = ({ userId, sessionId }) =>
  `${SCORE_DRAFT_STORAGE_KEY_PREFIX}:${userId ?? 'anonymous'}:${sessionId ?? 'none'}`;

const MapelScorePage = ({ user }) => {
  const [tanggal, setTanggal] = useState(getTodayDateWIB());
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [students, setStudents] = useState([]);
  const [scoreDraft, setScoreDraft] = useState({});
  const [scoreServerSnapshot, setScoreServerSnapshot] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncingQueue, setSyncingQueue] = useState(false);
  const [syncSummary, setSyncSummary] = useState({ total: 0, attendance: 0, score: 0 });
  const [autosaveEnabled, setAutosaveEnabled] = useState(true);
  const [autosaveHydrated, setAutosaveHydrated] = useState(false);
  const [savingRows, setSavingRows] = useState({});
  const [savedRows, setSavedRows] = useState({});
  const [queuedRows, setQueuedRows] = useState({});
  const [autosaveErrorRows, setAutosaveErrorRows] = useState({});
  const [loadingRecapFilters, setLoadingRecapFilters] = useState(false);
  const [loadingScoreRecap, setLoadingScoreRecap] = useState(false);
  const [hasAppliedScoreRecap, setHasAppliedScoreRecap] = useState(false);
  const [kelasOptions, setKelasOptions] = useState([]);
  const [mapelOptions, setMapelOptions] = useState([]);
  const [selectedKelasId, setSelectedKelasId] = useState('');
  const [selectedMapelId, setSelectedMapelId] = useState('');
  const [periodMode, setPeriodMode] = useState('monthly');
  const [anchorDate, setAnchorDate] = useState(getTodayDateWIB());
  const [fromDate, setFromDate] = useState(getTodayDateWIB());
  const [toDate, setToDate] = useState(getTodayDateWIB());
  const [scoreRecapPeriod, setScoreRecapPeriod] = useState(null);
  const [scoreRecapRows, setScoreRecapRows] = useState([]);
  const [scoreRecapSummary, setScoreRecapSummary] = useState({
    totalSiswa: 0,
    siswaDinilai: 0,
    siswaBelumDinilai: 0,
    rataRataCoverage: 0,
  });
  const [scoreRecapTotalPertemuan, setScoreRecapTotalPertemuan] = useState(0);
  const autosaveTimerRef = useRef({});
  const autosaveStorageKey = useMemo(() => resolveAutosaveStorageKey(user?.id), [user?.id]);
  const scoreDraftStorageKey = useMemo(
    () => resolveScoreDraftStorageKey({ userId: user?.id, sessionId: selectedSessionId }),
    [selectedSessionId, user?.id],
  );

  const selectedSession = useMemo(
    () => sessions.find((item) => String(item.id) === String(selectedSessionId)),
    [sessions, selectedSessionId],
  );

  const filteredStudents = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return students;
    return students.filter((student) => {
      const name = String(student.nama_siswa || '').toLowerCase();
      const nis = String(student.nis || '');
      return name.includes(keyword) || nis.includes(keyword);
    });
  }, [students, searchTerm]);

  const scoreSummary = useMemo(() => {
    const validScores = students
      .map((student) => Number(scoreDraft[student.id]?.nilai))
      .filter((nilai) => !Number.isNaN(nilai) && nilai >= SCORE_MIN && nilai <= SCORE_MAX);

    if (validScores.length === 0) {
      return { filled: 0, avg: 0, min: 0, max: 0 };
    }

    const total = validScores.reduce((acc, item) => acc + item, 0);
    return {
      filled: validScores.length,
      avg: Math.round((total / validScores.length) * 10) / 10,
      min: Math.min(...validScores),
      max: Math.max(...validScores),
    };
  }, [students, scoreDraft]);

  const scoreRecapPeriodLabel = useMemo(
    () => formatRecapPeriodLabel(scoreRecapPeriod),
    [scoreRecapPeriod],
  );
  const activeRecapKelasLabel = useMemo(() => {
    const found = kelasOptions.find((item) => String(item.id) === String(selectedKelasId));
    return found?.nama_kelas || '-';
  }, [kelasOptions, selectedKelasId]);
  const activeRecapMapelLabel = useMemo(() => {
    const found = mapelOptions.find((item) => String(item.id) === String(selectedMapelId));
    if (!found) return '-';
    return found.kode_mapel ? `${found.nama_mapel} (${found.kode_mapel})` : found.nama_mapel;
  }, [mapelOptions, selectedMapelId]);

  const refreshSyncSummary = () => {
    try {
      setSyncSummary(getMapelSyncQueueSummary());
    } catch (error) {
      console.error('Gagal membaca queue mapel:', error);
      setSyncSummary({ total: 0, attendance: 0, score: 0 });
    }
  };

  const loadSessions = async () => {
    const sessionRows = await fetchSessionsByTanggal(tanggal);
    setSessions(sessionRows);
    if (!sessionRows.length) {
      setSelectedSessionId('');
      return;
    }

    const stillExists = sessionRows.some((item) => String(item.id) === String(selectedSessionId));
    if (!stillExists) {
      setSelectedSessionId(String(sessionRows[0].id));
    }
  };

  useEffect(() => {
    setLoading(true);
    loadSessions()
      .catch((error) => Swal.fire('Gagal', error.message, 'error'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tanggal]);

  useEffect(() => {
    const loadStudentsAndScore = async () => {
      if (!selectedSession?.schedule?.kelas_id || !selectedSession?.id) {
        setStudents([]);
        setScoreDraft({});
        setScoreServerSnapshot({});
        return;
      }

      const [studentRows, scoreRows] = await Promise.all([
        fetchActiveStudentsByKelas(selectedSession.schedule.kelas_id),
        fetchDailyScoreBySession(selectedSession.id),
      ]);

      const scoreMap = {};
      scoreRows.forEach((row) => {
        scoreMap[row.siswa_id] = {
          nilai: row.nilai === null || row.nilai === undefined ? '' : String(row.nilai),
          catatan: row.catatan ?? '',
        };
      });

      let localDraft = {};
      try {
        const raw = localStorage.getItem(scoreDraftStorageKey);
        localDraft = raw ? JSON.parse(raw) : {};
      } catch {
        localDraft = {};
      }

      setStudents(studentRows);
      setScoreServerSnapshot(scoreMap);
      setScoreDraft({ ...scoreMap, ...localDraft });
    };

    loadStudentsAndScore().catch((error) => Swal.fire('Gagal', error.message, 'error'));
  }, [selectedSession?.id, selectedSession?.schedule?.kelas_id, scoreDraftStorageKey]);

  useEffect(() => {
    refreshSyncSummary();
  }, []);

  useEffect(() => {
    if (!selectedSession?.id) return;
    try {
      localStorage.setItem(scoreDraftStorageKey, JSON.stringify(scoreDraft));
    } catch {
      // Ignore storage failures; draft remains in memory.
    }
  }, [scoreDraft, scoreDraftStorageKey, selectedSession?.id]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(autosaveStorageKey);
      setAutosaveEnabled(raw === null ? true : raw === '1');
    } catch {
      setAutosaveEnabled(true);
    } finally {
      setAutosaveHydrated(true);
    }
  }, [autosaveStorageKey]);

  useEffect(() => {
    if (!autosaveHydrated) return;
    try {
      localStorage.setItem(autosaveStorageKey, autosaveEnabled ? '1' : '0');
    } catch {
      // Ignore storage failures silently; runtime behavior still follows in-memory toggle.
    }
  }, [autosaveEnabled, autosaveHydrated, autosaveStorageKey]);

  useEffect(() => {
    if (autosaveEnabled) return;
    Object.values(autosaveTimerRef.current).forEach((timer) => clearTimeout(timer));
    autosaveTimerRef.current = {};
  }, [autosaveEnabled]);

  useEffect(() => {
    return () => {
      Object.values(autosaveTimerRef.current).forEach((timer) => clearTimeout(timer));
      autosaveTimerRef.current = {};
    };
  }, []);

  useEffect(() => {
    const loadRecapFilterOptions = async () => {
      if (!user?.id) return;

      try {
        setLoadingRecapFilters(true);
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
        setLoadingRecapFilters(false);
      }
    };

    loadRecapFilterOptions();
  }, [user?.id]);

  const refreshScoreFromServer = async () => {
    if (!selectedSession?.id) return;
    const scoreRows = await fetchDailyScoreBySession(selectedSession.id);
    const nextServer = {};
    scoreRows.forEach((row) => {
      nextServer[row.siswa_id] = {
        nilai: row.nilai === null || row.nilai === undefined ? '' : String(row.nilai),
        catatan: row.catatan ?? '',
      };
    });
    setScoreServerSnapshot(nextServer);
    setScoreDraft((prev) => ({ ...nextServer, ...prev }));
  };

  const handleFlushSyncQueue = async ({ showSuccessAlert = true } = {}) => {
    try {
      setSyncingQueue(true);
      const result = await flushMapelSyncQueue();
      refreshSyncSummary();
      if (result.syncedCount > 0 && selectedSession?.id) {
        await refreshScoreFromServer();
      }
      if (showSuccessAlert) {
        if (result.skippedOffline) {
          await Swal.fire('Offline', 'Masih offline. Queue akan dikirim saat online.', 'info');
        } else if (result.syncedCount > 0) {
          const conflictInfo =
            result.conflictCount > 0
              ? ` (${result.conflictCount} konflik diselesaikan dengan aturan local-last-write).`
              : '.';
          await Swal.fire('Sinkronisasi selesai', `Berhasil sinkron ${result.syncedCount} item${conflictInfo}`, 'success');
        } else {
          await Swal.fire('Info', 'Tidak ada item queue yang perlu disinkronkan.', 'info');
        }
      } else if (result.conflictCount > 0) {
        await Swal.fire(
          'Konflik terselesaikan',
          `${result.conflictCount} item queue diselesaikan dengan aturan local-last-write.`,
          'warning',
        );
      }
    } catch (error) {
      await Swal.fire('Gagal sinkronisasi', error.message, 'error');
    } finally {
      setSyncingQueue(false);
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      handleFlushSyncQueue({ showSuccessAlert: false }).catch((error) => {
        console.error('Auto sync queue nilai gagal:', error);
      });
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSession?.id]);

  const handleDraftChange = (siswaId, key, value) => {
    let nextEntry = null;
    setScoreDraft((prev) => {
      nextEntry = {
        nilai: prev[siswaId]?.nilai ?? '',
        catatan: prev[siswaId]?.catatan ?? '',
        [key]: value,
      };
      return {
        ...prev,
        [siswaId]: nextEntry,
      };
    });
    setSavedRows((prev) => ({
      ...prev,
      [siswaId]: false,
    }));
    setAutosaveErrorRows((prev) => ({
      ...prev,
      [siswaId]: false,
    }));
    setQueuedRows((prev) => ({
      ...prev,
      [siswaId]: false,
    }));

    if (!autosaveEnabled || !selectedSession?.id || !nextEntry) return;
    if (autosaveTimerRef.current[siswaId]) {
      clearTimeout(autosaveTimerRef.current[siswaId]);
    }
    autosaveTimerRef.current[siswaId] = setTimeout(async () => {
      const student = students.find((item) => String(item.id) === String(siswaId));
      if (!student) return;

      try {
        const payload = validateEntry(student, nextEntry);
        if (!payload) return;
        setSavingRows((prev) => ({ ...prev, [siswaId]: true }));
        const result = await saveDailyScoreWithOfflineFallback({
          ...payload,
          base: scoreServerSnapshot[siswaId] || {},
        });
        refreshSyncSummary();
        if (result.mode === 'queued') {
          setQueuedRows((prev) => ({ ...prev, [siswaId]: true }));
          setSavedRows((prev) => ({ ...prev, [siswaId]: false }));
          return;
        }
        setQueuedRows((prev) => ({ ...prev, [siswaId]: false }));
        setScoreServerSnapshot((prev) => ({
          ...prev,
          [siswaId]: {
            nilai: payload.nilai === null || payload.nilai === undefined ? '' : String(payload.nilai),
            catatan: payload.catatan ?? '',
          },
        }));
        setSavedRows((prev) => ({ ...prev, [siswaId]: true }));
        setAutosaveErrorRows((prev) => ({ ...prev, [siswaId]: false }));
      } catch {
        setAutosaveErrorRows((prev) => ({ ...prev, [siswaId]: true }));
      } finally {
        setSavingRows((prev) => ({ ...prev, [siswaId]: false }));
      }
    }, AUTOSAVE_DELAY_MS);
  };

  const validateEntry = (student, entry) => {
    const hasNilai = String(entry.nilai ?? '').trim() !== '';
    const hasCatatan = String(entry.catatan ?? '').trim() !== '';
    if (!hasNilai && !hasCatatan) return null;

    if (!hasNilai) {
      throw new Error(`Nilai untuk ${student.nama_siswa} wajib diisi jika catatan diisi.`);
    }

    const parsed = Number(entry.nilai);
    if (Number.isNaN(parsed) || parsed < SCORE_MIN || parsed > SCORE_MAX) {
      throw new Error(`Nilai ${student.nama_siswa} harus angka ${SCORE_MIN}-${SCORE_MAX}.`);
    }

    return {
      sessionId: selectedSession.id,
      siswaId: student.id,
      nilai: parsed,
      catatan: String(entry.catatan ?? '').trim() || null,
    };
  };

  const handleSave = async () => {
    if (!selectedSession?.id) {
      Swal.fire('Info', 'Pilih sesi terlebih dahulu.', 'info');
      return;
    }

    try {
      const payload = students
        .map((student) => validateEntry(student, scoreDraft[student.id] ?? {}))
        .filter(Boolean);

      if (!payload.length) {
        Swal.fire('Info', 'Belum ada nilai bonus yang diisi.', 'info');
        return;
      }

      setSaving(true);
      const baseMap = payload.reduce((acc, item) => {
        acc[item.siswaId] = scoreServerSnapshot[item.siswaId] || {};
        return acc;
      }, {});
      const result = await saveBulkDailyScoreWithOfflineFallback({ entries: payload, baseMap });
      refreshSyncSummary();
      if (result.mode === 'queued') {
        setQueuedRows((prev) =>
          payload.reduce(
            (acc, item) => ({
              ...acc,
              [item.siswaId]: true,
            }),
            prev,
          ),
        );
        Swal.fire(
          'Tersimpan lokal',
          'Koneksi tidak stabil/offline. Nilai masuk queue lokal dan akan disinkron saat online.',
          'warning',
        );
        return;
      }
      setQueuedRows((prev) =>
        payload.reduce(
          (acc, item) => ({
            ...acc,
            [item.siswaId]: false,
          }),
          prev,
        ),
      );
      setScoreServerSnapshot((prev) =>
        payload.reduce(
          (acc, item) => ({
            ...acc,
            [item.siswaId]: {
              nilai: item.nilai === null || item.nilai === undefined ? '' : String(item.nilai),
              catatan: item.catatan ?? '',
            },
          }),
          prev,
        ),
      );
      setSavedRows((prev) =>
        payload.reduce(
          (acc, item) => ({
            ...acc,
            [item.siswaId]: true,
          }),
          prev,
        ),
      );
      Swal.fire('Berhasil', `Nilai harian tersimpan (${payload.length} siswa).`, 'success');
      await loadSessions();
    } catch (error) {
      Swal.fire('Gagal', error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRow = async (student) => {
    if (!selectedSession?.id) {
      Swal.fire('Info', 'Pilih sesi terlebih dahulu.', 'info');
      return;
    }

    try {
      const payload = validateEntry(student, scoreDraft[student.id] ?? {});
      if (!payload) {
        Swal.fire('Info', `Isi nilai ${student.nama_siswa} terlebih dahulu.`, 'info');
        return;
      }

      setSavingRows((prev) => ({
        ...prev,
        [student.id]: true,
      }));
      const result = await saveDailyScoreWithOfflineFallback({
        ...payload,
        base: scoreServerSnapshot[student.id] || {},
      });
      refreshSyncSummary();
      if (result.mode === 'queued') {
        setQueuedRows((prev) => ({
          ...prev,
          [student.id]: true,
        }));
        setSavedRows((prev) => ({
          ...prev,
          [student.id]: false,
        }));
        Swal.fire('Tersimpan lokal', 'Nilai disimpan ke queue lokal dan akan disinkron saat online.', 'warning');
        return;
      }
      setQueuedRows((prev) => ({
        ...prev,
        [student.id]: false,
      }));
      setScoreServerSnapshot((prev) => ({
        ...prev,
        [student.id]: {
          nilai: payload.nilai === null || payload.nilai === undefined ? '' : String(payload.nilai),
          catatan: payload.catatan ?? '',
        },
      }));
      setSavedRows((prev) => ({
        ...prev,
        [student.id]: true,
      }));
      setAutosaveErrorRows((prev) => ({
        ...prev,
        [student.id]: false,
      }));
    } catch (error) {
      Swal.fire('Gagal', error.message, 'error');
    } finally {
      setSavingRows((prev) => ({
        ...prev,
        [student.id]: false,
      }));
    }
  };

  const handleApplyScoreRecap = async () => {
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
      setLoadingScoreRecap(true);
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

      setScoreRecapRows(result.rows || []);
      setScoreRecapSummary(
        result.summary || {
          totalSiswa: 0,
          siswaDinilai: 0,
          siswaBelumDinilai: 0,
          rataRataCoverage: 0,
        },
      );
      setScoreRecapTotalPertemuan(Number(result.totalPertemuan || 0));
      setScoreRecapPeriod(result.period || null);
      setHasAppliedScoreRecap(true);
    } catch (error) {
      Swal.fire('Gagal', error.message, 'error');
    } finally {
      setLoadingScoreRecap(false);
    }
  };

  const handleDownloadScoreRecapExcel = async () => {
    if (!hasAppliedScoreRecap || scoreRecapRows.length === 0) {
      Swal.fire('Tidak ada data', 'Terapkan filter rekap nilai dulu sebelum export.', 'info');
      return;
    }

    await exportMapelScoreRecapToExcel({
      meta: {
        kelasLabel: activeRecapKelasLabel,
        mapelLabel: activeRecapMapelLabel,
        periodeLabel: scoreRecapPeriodLabel,
        totalPertemuanLabel: scoreRecapTotalPertemuan,
      },
      rows: buildScoreRecapExcelDataRows(scoreRecapRows),
      fileName: `Rekap_Nilai_Harian_${selectedKelasId || 'kelas'}_${selectedMapelId || 'mapel'}_${scoreRecapPeriod?.fromDate || 'from'}_${scoreRecapPeriod?.toDate || 'to'}.xlsx`
        .replace(/\s+/g, '_')
        .replace(/[^A-Za-z0-9_.-]/g, ''),
    });
  };

  return (
    <PageContainer>
      <PageHeader>
        <div className="space-y-2">
          <PageSubtitle>Modul Mapel</PageSubtitle>
          <PageTitle className="text-2xl md:text-3xl">Nilai Harian</PageTitle>
          <p className="text-sm text-slate-600">Input nilai bonus keaktifan per sesi mengajar dengan rentang nilai 0-100.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => setAutosaveEnabled((prev) => !prev)}>
            Auto-save: {autosaveEnabled ? 'ON' : 'OFF'}
          </Button>
          <Button
            variant="secondary"
            onClick={() => handleFlushSyncQueue({ showSuccessAlert: true })}
            disabled={syncingQueue || syncSummary.total === 0}
          >
            {syncingQueue ? 'Sinkronisasi...' : `Sinkron Offline (${syncSummary.total})`}
          </Button>
          <Button
            variant="secondary"
            onClick={handleDownloadScoreRecapExcel}
            disabled={loadingScoreRecap || !hasAppliedScoreRecap || scoreRecapRows.length === 0}
          >
            Download Excel Rekap
          </Button>
          <Button onClick={handleSave} disabled={saving || loading || !selectedSessionId}>
            <Save size={16} />
            {saving ? 'Menyimpan...' : 'Simpan Nilai'}
          </Button>
        </div>
      </PageHeader>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Filter Sesi</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tanggal</span>
            <input
              type="date"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              value={tanggal}
              onChange={(event) => setTanggal(event.target.value)}
            />
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sesi</span>
            <select
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              value={selectedSessionId}
              onChange={(event) => setSelectedSessionId(event.target.value)}
            >
              {!sessions.length && <option value="">Belum ada sesi pada tanggal ini</option>}
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.schedule?.master_kelas?.nama_kelas || '-'} - {session.schedule?.master_mapel?.nama_mapel || '-'}
                </option>
              ))}
            </select>
          </label>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader className="pb-4">
          <CardTitle>Daftar Nilai Siswa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 md:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">Terisi</p>
              <p className="text-lg font-bold text-slate-800">
                {scoreSummary.filled}/{students.length}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">Rata-rata</p>
              <p className="text-lg font-bold text-slate-800">{scoreSummary.avg}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">Nilai Min</p>
              <p className="text-lg font-bold text-slate-800">{scoreSummary.min}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">Nilai Max</p>
              <p className="text-lg font-bold text-slate-800">{scoreSummary.max}</p>
            </div>
          </div>
          <p className="text-xs font-medium text-slate-500">
            Auto-save saat ini: <span className="font-semibold text-slate-700">{autosaveEnabled ? 'Aktif' : 'Nonaktif'}</span>
          </p>
          {syncSummary.total > 0 && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
              Ada {syncSummary.total} item pending sinkronisasi ({syncSummary.attendance} absensi, {syncSummary.score} nilai).
            </p>
          )}
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Cari nama atau NIS..."
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="premium-table min-w-full text-sm">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left">Nama</th>
                  <th className="px-3 py-2 text-left">NIS</th>
                  <th className="px-3 py-2 text-left">Nilai</th>
                  <th className="px-3 py-2 text-left">Catatan</th>
                  <th className="px-3 py-2 text-left">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => (
                  <tr key={student.id}>
                    <td className="px-3 py-2 font-medium">{student.nama_siswa}</td>
                    <td className="px-3 py-2">{student.nis || '-'}</td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={SCORE_MIN}
                        max={SCORE_MAX}
                        value={scoreDraft[student.id]?.nilai ?? ''}
                        onChange={(event) => handleDraftChange(student.id, 'nilai', event.target.value)}
                        className="w-24 rounded-lg border border-slate-200 bg-white px-2 py-1.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        placeholder="0-100"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={scoreDraft[student.id]?.catatan ?? ''}
                        onChange={(event) => handleDraftChange(student.id, 'catatan', event.target.value)}
                        className="w-full min-w-48 rounded-lg border border-slate-200 bg-white px-2 py-1.5 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                        placeholder="Opsional"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleSaveRow(student)}
                          disabled={saving || loading || !selectedSessionId || savingRows[student.id]}
                        >
                          {savingRows[student.id] ? 'Menyimpan...' : 'Simpan'}
                        </Button>
                        {savedRows[student.id] && <span className="text-xs font-semibold text-emerald-600">Tersimpan</span>}
                        {queuedRows[student.id] && (
                          <span className="text-xs font-semibold text-amber-600">Pending Sync</span>
                        )}
                        {autosaveErrorRows[student.id] && (
                          <span className="text-xs font-semibold text-rose-600">Auto-save gagal</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!filteredStudents.length && (
                  <tr>
                    <td colSpan={5} className="px-3 py-5 text-center text-slate-500">
                      {selectedSessionId ? 'Tidak ada siswa aktif untuk kelas ini.' : 'Pilih sesi untuk mulai input nilai.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader className="pb-4">
          <CardTitle>Rekap Nilai Keaktifan (Bonus)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Kelas</span>
              <select
                value={selectedKelasId}
                onChange={(event) => setSelectedKelasId(event.target.value)}
                disabled={loadingRecapFilters}
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
                disabled={loadingRecapFilters}
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
              <Button
                onClick={handleApplyScoreRecap}
                disabled={loadingRecapFilters || loadingScoreRecap || !selectedKelasId || !selectedMapelId}
              >
                {loadingScoreRecap ? 'Memuat...' : 'Terapkan Rekap'}
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

          {hasAppliedScoreRecap && (
            <>
              <div className="grid gap-2 md:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-500">Total Pertemuan</p>
                  <p className="text-lg font-bold text-slate-800">{scoreRecapTotalPertemuan}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-500">Siswa Dinilai</p>
                  <p className="text-lg font-bold text-slate-800">
                    {scoreRecapSummary.siswaDinilai}/{scoreRecapSummary.totalSiswa}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-500">Belum Dinilai</p>
                  <p className="text-lg font-bold text-slate-800">{scoreRecapSummary.siswaBelumDinilai}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-500">Rata-rata Cakupan Penilaian</p>
                  <p className="text-lg font-bold text-slate-800">{scoreRecapSummary.rataRataCoverage}%</p>
                </div>
              </div>

              <p className="text-xs font-medium text-slate-500">Periode aktif: {scoreRecapPeriodLabel}</p>

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
                    {scoreRecapRows.map((row) => (
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
                    {scoreRecapRows.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-3 py-5 text-center text-slate-500">
                          Tidak ada data nilai untuk filter periode ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
};

export default MapelScorePage;
