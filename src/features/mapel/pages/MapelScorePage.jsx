import React, { useEffect, useMemo, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import { Save } from 'lucide-react';

import {
  fetchDailyScoreBySession,
  fetchSessionsByTanggal,
  upsertDailyScore,
} from '../../../services/mapelService';
import { fetchActiveStudentsByKelas } from '../../../services/absensiService';
import Button from '../../../shared/ui/Button';
import Card, { CardContent, CardHeader, CardTitle } from '../../../shared/ui/Card';
import { PageContainer, PageHeader, PageSubtitle, PageTitle } from '../../../shared/ui/PageLayout';

const SCORE_MIN = 0;
const SCORE_MAX = 100;
const AUTOSAVE_DELAY_MS = 900;
const AUTOSAVE_STORAGE_KEY_PREFIX = 'mapel_score_autosave';
const SCORE_DRAFT_STORAGE_KEY_PREFIX = 'mapel_score_draft';

const resolveAutosaveStorageKey = (userId) => `${AUTOSAVE_STORAGE_KEY_PREFIX}:${userId ?? 'anonymous'}`;
const resolveScoreDraftStorageKey = ({ userId, sessionId }) =>
  `${SCORE_DRAFT_STORAGE_KEY_PREFIX}:${userId ?? 'anonymous'}:${sessionId ?? 'none'}`;

const MapelScorePage = ({ user }) => {
  const [tanggal, setTanggal] = useState(new Date().toISOString().slice(0, 10));
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [students, setStudents] = useState([]);
  const [scoreDraft, setScoreDraft] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autosaveEnabled, setAutosaveEnabled] = useState(true);
  const [autosaveHydrated, setAutosaveHydrated] = useState(false);
  const [savingRows, setSavingRows] = useState({});
  const [savedRows, setSavedRows] = useState({});
  const [autosaveErrorRows, setAutosaveErrorRows] = useState({});
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
      setScoreDraft({ ...scoreMap, ...localDraft });
    };

    loadStudentsAndScore().catch((error) => Swal.fire('Gagal', error.message, 'error'));
  }, [selectedSession?.id, selectedSession?.schedule?.kelas_id, scoreDraftStorageKey]);

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
        await upsertDailyScore(payload);
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
        Swal.fire('Info', 'Belum ada nilai yang diisi.', 'info');
        return;
      }

      setSaving(true);
      await Promise.all(payload.map((item) => upsertDailyScore(item)));
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
      await upsertDailyScore(payload);
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

  return (
    <PageContainer>
      <PageHeader>
        <div className="space-y-2">
          <PageSubtitle>Modul Mapel</PageSubtitle>
          <PageTitle className="text-2xl md:text-3xl">Nilai Harian</PageTitle>
          <p className="text-sm text-slate-600">Input nilai per sesi mengajar dengan rentang nilai 0-100.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => setAutosaveEnabled((prev) => !prev)}>
            Auto-save: {autosaveEnabled ? 'ON' : 'OFF'}
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
    </PageContainer>
  );
};

export default MapelScorePage;
