import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import { Html5Qrcode } from 'html5-qrcode';

import {
  checkInSession,
  checkOutSession,
  createTeacherAbsenceTask,
  createSession,
  fetchClassAgendaBySession,
  fetchSchedulesByGuru,
  fetchStudentAttendanceBySession,
  fetchTeacherAbsenceTaskBySession,
  fetchSessionsByTanggal,
  hasSubmittedAgenda,
  markSessionTidakMasuk,
  upsertClassAgenda,
} from '../../../services/mapelService';
import { uploadBuktiAbsen, uploadMapelSessionPhoto } from '../../../services/supabase/storageService';
import { compressImageExtreme } from '../../../shared/utils/compressor';
import { fetchActiveStudentsByKelas } from '../../../services/absensiService';
import {
  flushMapelSyncQueue,
  getMapelSyncQueueSummary,
  saveAttendanceWithOfflineFallback,
} from '../../../services/mapelSyncQueueService';
import { getTodayDateWIB } from '../../../services/shared/dateService';
import Button from '../../../shared/ui/Button';
import Card, { CardContent } from '../../../shared/ui/Card';
import { PageContainer, PageHeader, PageSubtitle, PageTitle } from '../../../shared/ui/PageLayout';

const QR_READER_ELEMENT_ID = 'mapel-qr-reader';
const ATTENDANCE_DRAFT_KEY_PREFIX = 'mapel_attendance_draft';
const buildAttendanceDraftKey = ({ userId, sessionId }) =>
  `${ATTENDANCE_DRAFT_KEY_PREFIX}:${userId ?? 'anonymous'}:${sessionId ?? 'none'}`;

const normalizeAttendanceCode = (statusValue) => {
  const statusLabel = String(statusValue || '').trim().toUpperCase();
  if (statusLabel === 'HADIR' || statusLabel === 'H') return 'H';
  if (statusLabel === 'SAKIT' || statusLabel === 'S') return 'S';
  if (statusLabel === 'IZIN' || statusLabel === 'I') return 'I';
  if (statusLabel === 'ALPHA' || statusLabel === 'A') return 'A';
  return statusValue;
};

const MapelSessionPage = ({ user }) => {
  const [schedules, setSchedules] = useState([]);
  const [todaySessions, setTodaySessions] = useState([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastCompressionMeta, setLastCompressionMeta] = useState(null);
  const [agendaDraft, setAgendaDraft] = useState({ topik: '', metode: '' });
  const [agendaSubmitted, setAgendaSubmitted] = useState(false);
  const [students, setStudents] = useState([]);
  const [attendanceDraft, setAttendanceDraft] = useState({});
  const [attendanceServerSnapshot, setAttendanceServerSnapshot] = useState({});
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [syncingQueue, setSyncingQueue] = useState(false);
  const [syncSummary, setSyncSummary] = useState({ total: 0, attendance: 0, score: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const [qrStatusCode, setQrStatusCode] = useState('H');
  const [qrLastResult, setQrLastResult] = useState('');
  const [absenceInstruksi, setAbsenceInstruksi] = useState('');
  const [absenceFile, setAbsenceFile] = useState(null);
  const [absenceTask, setAbsenceTask] = useState(null);
  const [savingAbsenceTask, setSavingAbsenceTask] = useState(false);
  const qrScannerRef = useRef(null);
  const qrScanLockRef = useRef(false);
  const qrLastDecodedRef = useRef('');
  const guruId = user?.id;
  const today = useMemo(() => getTodayDateWIB(), []);

  const loadData = useCallback(async () => {
    if (!guruId) return;
    const [scheduleData, sessionData] = await Promise.all([fetchSchedulesByGuru(guruId), fetchSessionsByTanggal(today)]);
    setSchedules(scheduleData);
    setTodaySessions(sessionData);
    if (!selectedScheduleId && scheduleData.length > 0) {
      setSelectedScheduleId(String(scheduleData[0].id));
    }
  }, [guruId, selectedScheduleId, today]);

  useEffect(() => {
    loadData().catch((error) => Swal.fire('Gagal', error.message, 'error'));
  }, [loadData]);

  const selectedSchedule = schedules.find((item) => String(item.id) === String(selectedScheduleId));
  const currentSession = todaySessions.find((item) => String(item.schedule_id) === String(selectedScheduleId));
  const attendanceDraftStorageKey = buildAttendanceDraftKey({
    userId: user?.id,
    sessionId: currentSession?.id,
  });
  const filteredStudents = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    return students.filter((student) => {
      const matchesKeyword =
        keyword.length === 0 ||
        String(student.nama_siswa || '')
          .toLowerCase()
          .includes(keyword) ||
        String(student.nis || '').includes(keyword);

      const currentStatus = attendanceDraft[student.id];
      const matchesStatus = statusFilter === 'all' || currentStatus === statusFilter;
      return matchesKeyword && matchesStatus;
    });
  }, [students, searchTerm, statusFilter, attendanceDraft]);

  const attendanceSummary = useMemo(() => {
    const summary = { H: 0, S: 0, I: 0, A: 0, filled: 0 };
    students.forEach((student) => {
      const status = attendanceDraft[student.id];
      if (['H', 'S', 'I', 'A'].includes(status)) {
        summary[status] += 1;
        summary.filled += 1;
      }
    });
    return summary;
  }, [students, attendanceDraft]);

  const statusTone = {
    H: 'bg-blue-600 text-white',
    S: 'bg-green-600 text-white',
    I: 'bg-amber-500 text-white',
    A: 'bg-rose-600 text-white',
  };

  const refreshSyncSummary = useCallback(() => {
    try {
      setSyncSummary(getMapelSyncQueueSummary());
    } catch (error) {
      console.error('Gagal membaca queue mapel:', error);
      setSyncSummary({ total: 0, attendance: 0, score: 0 });
    }
  }, []);

  useEffect(() => {
    const loadAgenda = async () => {
      if (!currentSession?.id) {
        setAgendaDraft({ topik: '', metode: '' });
        setAgendaSubmitted(false);
        return;
      }

      const [agenda, isSubmitted] = await Promise.all([
        fetchClassAgendaBySession(currentSession.id),
        hasSubmittedAgenda(currentSession.id),
      ]);
      setAgendaDraft({
        topik: agenda?.topik ?? '',
        metode: agenda?.metode ?? '',
      });
      setAgendaSubmitted(isSubmitted);
    };

    loadAgenda().catch((error) => Swal.fire('Gagal', error.message, 'error'));
  }, [currentSession?.id]);

  useEffect(() => {
    const loadStudentsAndAttendance = async () => {
      if (!selectedSchedule?.kelas_id) {
        setStudents([]);
        setAttendanceDraft({});
        setAttendanceServerSnapshot({});
        setAbsenceTask(null);
        return;
      }

      const studentRows = await fetchActiveStudentsByKelas(selectedSchedule.kelas_id);
      setStudents(studentRows);

      if (!currentSession?.id) {
        setAttendanceDraft({});
        setAttendanceServerSnapshot({});
        setAbsenceTask(null);
        return;
      }

      const [existing, task] = await Promise.all([
        fetchStudentAttendanceBySession(currentSession.id),
        fetchTeacherAbsenceTaskBySession(currentSession.id),
      ]);
      const map = {};
      existing.forEach((item) => {
        map[item.siswa_id] = normalizeAttendanceCode(item.status);
      });
      setAbsenceTask(task);
      setAttendanceServerSnapshot(map);

      let localDraft = {};
      try {
        const raw = localStorage.getItem(attendanceDraftStorageKey);
        localDraft = raw ? JSON.parse(raw) : {};
      } catch {
        localDraft = {};
      }

      setAttendanceDraft({ ...map, ...localDraft });
    };

    loadStudentsAndAttendance().catch((error) => Swal.fire('Gagal', error.message, 'error'));
  }, [selectedSchedule?.kelas_id, currentSession?.id, attendanceDraftStorageKey]);

  useEffect(() => {
    refreshSyncSummary();
  }, [refreshSyncSummary]);

  const refreshAttendanceFromServer = useCallback(async () => {
    if (!currentSession?.id) return;
    const existing = await fetchStudentAttendanceBySession(currentSession.id);
    const map = {};
    existing.forEach((item) => {
      map[item.siswa_id] = normalizeAttendanceCode(item.status);
    });
    setAttendanceDraft(map);
    setAttendanceServerSnapshot(map);
  }, [currentSession?.id]);

  const handleFlushSyncQueue = useCallback(
    async ({ showSuccessAlert = true } = {}) => {
      try {
        setSyncingQueue(true);
        const result = await flushMapelSyncQueue();
        refreshSyncSummary();
        if (result.syncedCount > 0 && currentSession?.id) {
          await refreshAttendanceFromServer();
        }
        if (showSuccessAlert) {
          if (result.skippedOffline) {
            await Swal.fire('Offline', 'Masih offline. Queue akan dikirim saat koneksi kembali.', 'info');
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
    },
    [currentSession?.id, refreshAttendanceFromServer, refreshSyncSummary],
  );

  useEffect(() => {
    const handleOnline = () => {
      handleFlushSyncQueue({ showSuccessAlert: false }).catch((error) => {
        console.error('Auto sync queue gagal:', error);
      });
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [handleFlushSyncQueue]);

  useEffect(() => {
    if (!currentSession?.id) return;
    try {
      localStorage.setItem(attendanceDraftStorageKey, JSON.stringify(attendanceDraft));
    } catch {
      // Ignore storage failures; attendance draft still lives in-memory.
    }
  }, [attendanceDraft, attendanceDraftStorageKey, currentSession?.id]);

  const ensureSession = async () => {
    if (!selectedScheduleId) {
      throw new Error('Pilih jadwal dulu sebelum memulai sesi');
    }

    if (currentSession) return currentSession;
    const created = await createSession({ scheduleId: selectedScheduleId, tanggal: today });
    await loadData();
    return created;
  };

  const capturePhotoFromCamera = async (phase) => {
    if (!navigator?.mediaDevices?.getUserMedia) {
      throw new Error('Perangkat/browser ini tidak mendukung akses kamera.');
    }

    let stream = null;
    const videoId = `mapel-camera-preview-${phase}`;
    const canvasId = `mapel-camera-canvas-${phase}`;

    const result = await Swal.fire({
      title: phase === 'check_in' ? 'Ambil Foto Check-In (Kamera)' : 'Ambil Foto Check-Out (Kamera)',
      html: `
        <div style="display:flex;flex-direction:column;gap:8px">
          <video id="${videoId}" autoplay playsinline muted style="width:100%;border-radius:12px;background:#000;min-height:220px;"></video>
          <p style="font-size:12px;color:#64748b;margin:0">Wajib ambil foto langsung dari kamera.</p>
          <canvas id="${canvasId}" style="display:none;"></canvas>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Ambil Foto',
      confirmButtonColor: '#2563eb',
      cancelButtonText: 'Batal',
      allowOutsideClick: false,
      didOpen: async () => {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' } },
            audio: false,
          });
          const videoEl = document.getElementById(videoId);
          if (videoEl) {
            videoEl.srcObject = stream;
            await videoEl.play();
          }
        } catch (error) {
          Swal.showValidationMessage(`Gagal membuka kamera: ${error.message}`);
        }
      },
      preConfirm: async () => {
        const videoEl = document.getElementById(videoId);
        const canvasEl = document.getElementById(canvasId);
        if (!videoEl || !canvasEl) {
          Swal.showValidationMessage('Preview kamera tidak tersedia.');
          return null;
        }

        if (!videoEl.videoWidth || !videoEl.videoHeight) {
          Swal.showValidationMessage('Kamera belum siap. Coba tunggu 1-2 detik.');
          return null;
        }

        canvasEl.width = videoEl.videoWidth;
        canvasEl.height = videoEl.videoHeight;
        const ctx = canvasEl.getContext('2d');
        if (!ctx) {
          Swal.showValidationMessage('Gagal memproses frame kamera.');
          return null;
        }

        ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);
        const blob = await new Promise((resolve) => canvasEl.toBlob(resolve, 'image/jpeg', 0.92));
        if (!blob) {
          Swal.showValidationMessage('Gagal menangkap foto dari kamera.');
          return null;
        }

        return new File([blob], `${phase}-${Date.now()}.jpg`, { type: 'image/jpeg' });
      },
      willClose: () => {
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
          stream = null;
        }
      },
    });

    return result.value || null;
  };

  const handlePhotoAction = async (phase) => {
    const file = await capturePhotoFromCamera(phase);
    if (!file) return;

    setLoading(true);
    Swal.fire({ title: 'Memproses foto...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
    try {
      const session = await ensureSession();
      const compressed = await compressImageExtreme(file);
      const upload = await uploadMapelSessionPhoto({
        sessionId: session.id,
        phase,
        file: compressed.file,
        metadata: compressed.metadata,
      });

      if (phase === 'check_in') {
        await checkInSession(session.id, upload.publicUrl, {
          actorName: user?.nama_lengkap,
        });
      } else {
        await checkOutSession(session.id, upload.publicUrl, {
          actorName: user?.nama_lengkap,
        });
      }

      setLastCompressionMeta(compressed.metadata);
      await loadData();
      Swal.fire(
        'Berhasil',
        `Foto ${phase === 'check_in' ? 'check-in' : 'check-out'} tersimpan (${(compressed.metadata.compressedSizeBytes / 1024).toFixed(1)}KB).`,
        'success',
      );
    } catch (error) {
      Swal.fire('Gagal', error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAgenda = async () => {
    if (!agendaDraft.topik.trim()) {
      Swal.fire('Gagal', 'Topik/agenda wajib diisi dulu.', 'error');
      return;
    }

    try {
      setLoading(true);
      const session = await ensureSession();
      await upsertClassAgenda({
        sessionId: session.id,
        topik: agendaDraft.topik.trim(),
        metode: agendaDraft.metode.trim() || null,
        actorName: user?.nama_lengkap,
      });
      setAgendaSubmitted(true);
      Swal.fire('Berhasil', 'Agenda tersimpan. Scanner QR sekarang bisa dibuka.', 'success');
    } catch (error) {
      Swal.fire('Gagal', error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenQrScanner = () => {
    if (!agendaSubmitted) {
      Swal.fire('Agenda belum ada', 'Submit topik/metode dulu sebelum membuka scanner QR.', 'warning');
      return;
    }
    if (!currentSession) {
      Swal.fire('Sesi belum siap', 'Buat sesi dulu dengan submit agenda atau check-in foto.', 'warning');
      return;
    }
    if (students.length === 0) {
      Swal.fire('Belum ada siswa', 'Tidak ada data siswa aktif untuk jadwal ini.', 'warning');
      return;
    }

    setQrScannerOpen((prev) => !prev);
  };

  const stopQrScanner = useCallback(async () => {
    const scanner = qrScannerRef.current;
    if (!scanner) return;

    try {
      await scanner.stop();
    } catch (error) {
      console.warn('QR stop warning:', error.message);
    }

    try {
      await scanner.clear();
    } catch (error) {
      console.warn('QR clear warning:', error.message);
    }

    qrScannerRef.current = null;
  }, []);

  const parseQrCandidates = useCallback((rawText) => {
    const text = String(rawText || '').trim();
    if (!text) return [];

    const candidates = [text];
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object') {
        [
          parsed.siswa_id,
          parsed.siswaId,
          parsed.id,
          parsed.student_id,
          parsed.nis,
          parsed.code,
        ].forEach((value) => {
          if (value !== undefined && value !== null && String(value).trim()) {
            candidates.push(String(value).trim());
          }
        });
      }
    } catch {
      // QR raw text non-JSON tetap valid sebagai kandidat.
    }

    return [...new Set(candidates)];
  }, []);

  useEffect(() => {
    if (!qrScannerOpen || !agendaSubmitted || !currentSession || students.length === 0) {
      stopQrScanner().catch((error) => console.warn('QR stop failed:', error.message));
      return;
    }

    const startScanner = async () => {
      try {
        const cameras = await Html5Qrcode.getCameras();
        if (!Array.isArray(cameras) || cameras.length === 0) {
          throw new Error('Kamera tidak ditemukan di perangkat ini.');
        }

        const preferredCamera =
          cameras.find((camera) => /back|rear|environment/i.test(String(camera.label || ''))) || cameras[0];
        const scanner = new Html5Qrcode(QR_READER_ELEMENT_ID);
        qrScannerRef.current = scanner;

        await scanner.start(
          preferredCamera.id,
          { fps: 10, qrbox: { width: 240, height: 240 } },
          async (decodedText) => {
            if (qrScanLockRef.current) return;
            if (decodedText === qrLastDecodedRef.current) return;

            qrScanLockRef.current = true;
            qrLastDecodedRef.current = decodedText;

            try {
              const candidates = parseQrCandidates(decodedText);
              const matchedStudent = students.find((student) =>
                candidates.some(
                  (candidate) =>
                    String(student.id) === candidate ||
                    String(student.nis || '').toLowerCase() === candidate.toLowerCase(),
                ),
              );

              if (!matchedStudent) {
                setQrLastResult(`QR tidak dikenali: ${decodedText}`);
                return;
              }

              setAttendanceDraft((prev) => ({ ...prev, [matchedStudent.id]: qrStatusCode }));
              setQrLastResult(`Terbaca: ${matchedStudent.nama_siswa} (${matchedStudent.nis || '-'}) -> ${qrStatusCode}`);
            } finally {
              setTimeout(() => {
                qrScanLockRef.current = false;
              }, 400);
            }
          },
          () => {},
        );
      } catch (error) {
        setQrScannerOpen(false);
        await stopQrScanner();
        Swal.fire('Scanner gagal dibuka', error.message, 'error');
      }
    };

    startScanner();

    return () => {
      stopQrScanner().catch((error) => console.warn('QR cleanup failed:', error.message));
    };
  }, [agendaSubmitted, currentSession, parseQrCandidates, qrScannerOpen, qrStatusCode, stopQrScanner, students]);

  const pickManualStatus = (siswaId, status) => {
    setAttendanceDraft((prev) => ({ ...prev, [siswaId]: status }));
  };

  const applyStatusToVisible = (statusCode) => {
    const updates = {};
    filteredStudents.forEach((student) => {
      updates[student.id] = statusCode;
    });
    setAttendanceDraft((prev) => ({ ...prev, ...updates }));
  };

  const clearVisibleDraft = () => {
    const next = { ...attendanceDraft };
    filteredStudents.forEach((student) => {
      delete next[student.id];
    });
    setAttendanceDraft(next);
  };

  const handleSaveManualAttendance = async () => {
    if (!agendaSubmitted) {
      Swal.fire('Agenda belum ada', 'Submit agenda dulu sebelum menyimpan absensi.', 'warning');
      return;
    }

    if (!currentSession?.id) {
      Swal.fire('Sesi belum siap', 'Buat sesi dulu dengan submit agenda atau check-in foto.', 'warning');
      return;
    }

    const entries = Object.entries(attendanceDraft).map(([siswaId, status]) => ({
      sessionId: currentSession.id,
      siswaId,
      status,
    }));
    if (entries.length === 0) {
      Swal.fire('Belum ada data', 'Silakan klik status manual minimal untuk 1 siswa.', 'info');
      return;
    }

    try {
      setSavingAttendance(true);
      const result = await saveAttendanceWithOfflineFallback({
        sessionId: currentSession.id,
        entries,
        actorName: user?.nama_lengkap,
        source: 'manual_click',
        baseMap: attendanceServerSnapshot,
      });
      refreshSyncSummary();
      if (result.mode === 'queued') {
        Swal.fire(
          'Tersimpan lokal',
          'Koneksi tidak stabil/offline. Absensi disimpan ke queue lokal dan akan disinkron saat online.',
          'warning',
        );
      } else {
        await refreshAttendanceFromServer();
        Swal.fire('Berhasil', 'Absensi manual berhasil disimpan.', 'success');
      }
    } catch (error) {
      Swal.fire('Gagal', error.message, 'error');
    } finally {
      setSavingAttendance(false);
    }
  };

  const handleSubmitGuruTidakMasuk = async () => {
    if (!absenceInstruksi.trim()) {
      Swal.fire('Gagal', 'Instruksi tugas pengganti wajib diisi.', 'error');
      return;
    }

    if (absenceTask?.id) {
      Swal.fire('Info', 'Tugas pengganti untuk sesi ini sudah pernah dibuat.', 'info');
      return;
    }

    try {
      setSavingAbsenceTask(true);
      const session = await ensureSession();
      let filePath = null;

      if (absenceFile) {
        const safeName = `${Date.now()}-${String(absenceFile.name || 'lampiran').replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const fullPath = `kbm/absence-task/${session.id}-${safeName}`;
        filePath = await uploadBuktiAbsen(fullPath, absenceFile);
      }

      await markSessionTidakMasuk(session.id);
      const createdTask = await createTeacherAbsenceTask({
        sessionId: session.id,
        filePath,
        instruksi: absenceInstruksi.trim(),
      });
      setAbsenceTask(createdTask);
      await loadData();
      Swal.fire('Berhasil', 'Sesi ditandai tidak masuk dan tugas pengganti tersimpan.', 'success');
    } catch (error) {
      Swal.fire('Gagal', error.message, 'error');
    } finally {
      setSavingAbsenceTask(false);
    }
  };

  return (
    <PageContainer className="max-w-5xl space-y-5">
      <PageHeader className="block">
        <PageTitle className="text-2xl md:text-3xl">Sesi KBM Hari Ini</PageTitle>
        <PageSubtitle className="mt-2 normal-case tracking-wide text-slate-500">Pilih jadwal aktif, lalu lakukan check-in dan check-out berbasis foto.</PageSubtitle>
      </PageHeader>

      <Card className="rounded-3xl">
        <CardContent className="space-y-4 p-5 md:p-6">
        <label className="text-sm font-bold text-gray-600 block">
          Jadwal Hari Ini
          <select
            className="w-full mt-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 font-semibold"
            value={selectedScheduleId}
            onChange={(e) => setSelectedScheduleId(e.target.value)}
          >
            <option value="">Pilih jadwal</option>
            {schedules.map((item) => (
              <option key={item.id} value={item.id}>
                {item.hari} • {String(item.jam_mulai).slice(0, 5)}-{String(item.jam_selesai).slice(0, 5)} •{' '}
                {item.master_kelas?.nama_kelas ?? '-'} • {item.master_mapel?.nama_mapel ?? '-'}
              </option>
            ))}
          </select>
        </label>

        <div className="text-sm text-gray-600 bg-blue-50 rounded-xl p-3">
          Status sesi: <span className="font-black text-blue-700">{currentSession?.status ?? 'Belum dibuat'}</span>
          {selectedSchedule && (
            <div className="mt-1 text-xs text-gray-500">
              Jadwal: {selectedSchedule.hari}, {String(selectedSchedule.jam_mulai).slice(0, 5)}-
              {String(selectedSchedule.jam_selesai).slice(0, 5)}
            </div>
          )}
        </div>

        {lastCompressionMeta && (
          <div className="text-xs text-gray-500">
            Kompresi terakhir: {(lastCompressionMeta.originalSizeBytes / 1024).toFixed(1)}KB →{' '}
            {(lastCompressionMeta.compressedSizeBytes / 1024).toFixed(1)}KB
          </div>
        )}

        <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 space-y-3">
          <p className="text-xs font-black uppercase tracking-wide text-gray-700">Agenda Wajib Sebelum QR</p>
          <input
            type="text"
            value={agendaDraft.topik}
            onChange={(e) => setAgendaDraft((prev) => ({ ...prev, topik: e.target.value }))}
            placeholder="Topik pembelajaran"
            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold"
          />
          <input
            type="text"
            value={agendaDraft.metode}
            onChange={(e) => setAgendaDraft((prev) => ({ ...prev, metode: e.target.value }))}
            placeholder="Metode (opsional)"
            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={handleSubmitAgenda}
              disabled={loading || !selectedScheduleId}
              variant="secondary"
              size="sm"
              className="uppercase tracking-wide"
            >
              Submit Agenda
            </Button>
            <span className={`text-xs font-bold ${agendaSubmitted ? 'text-green-600' : 'text-amber-600'}`}>
              {agendaSubmitted ? 'Agenda sudah tersubmit' : 'Agenda belum tersubmit'}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 space-y-3">
          <p className="text-xs font-black uppercase tracking-wide text-rose-700">Mode Guru Tidak Masuk + Tugas Pengganti</p>
          <textarea
            value={absenceInstruksi}
            onChange={(e) => setAbsenceInstruksi(e.target.value)}
            rows={3}
            placeholder="Tulis instruksi tugas pengganti untuk siswa..."
            className="w-full bg-white border border-rose-200 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700"
          />
          <input
            type="file"
            onChange={(e) => setAbsenceFile(e.target.files?.[0] ?? null)}
            className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:font-semibold"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={handleSubmitGuruTidakMasuk}
              disabled={savingAbsenceTask || !selectedScheduleId || !absenceInstruksi.trim() || !!absenceTask?.id}
              size="sm"
              className="bg-rose-600 border-rose-600 hover:bg-rose-700 uppercase tracking-wide"
            >
              {savingAbsenceTask ? 'Menyimpan...' : 'Simpan Tidak Masuk'}
            </Button>
            {absenceTask?.id && <span className="text-xs font-bold text-rose-700">Tugas pengganti sudah tersimpan.</span>}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => handlePhotoAction('check_in')}
            disabled={loading || !selectedScheduleId}
            size="sm"
            className="bg-green-600 border-green-600 hover:bg-green-700 uppercase tracking-wide"
          >
            Check-In Foto
          </Button>
          <Button
            onClick={() => handlePhotoAction('check_out')}
            disabled={loading || !selectedScheduleId || !currentSession}
            size="sm"
            className="bg-orange-500 border-orange-500 hover:bg-orange-600 uppercase tracking-wide"
          >
            Check-Out Foto
          </Button>
          <Button
            onClick={handleOpenQrScanner}
            disabled={!agendaSubmitted || !currentSession}
            variant="ghost"
            size="sm"
            className="border-slate-300 uppercase tracking-wide"
          >
            {qrScannerOpen ? 'Tutup Scanner QR' : 'Buka Scanner QR'}
          </Button>
        </div>

        {qrScannerOpen && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3">
            <p className="text-xs font-black uppercase tracking-wide text-slate-700">Scanner QR (Opsional)</p>
            <div className="flex flex-wrap gap-2">
              {['H', 'S', 'I', 'A'].map((statusCode) => (
                <button
                  key={`qr-status-${statusCode}`}
                  onClick={() => setQrStatusCode(statusCode)}
                  className={`px-3 py-2 rounded-lg text-[11px] font-black uppercase tracking-wide ${
                    qrStatusCode === statusCode ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-700'
                  }`}
                >
                  Mode {statusCode}
                </button>
              ))}
            </div>
            <div id={QR_READER_ELEMENT_ID} className="w-full max-w-sm rounded-lg overflow-hidden border border-slate-200 bg-black/5" />
            {qrLastResult && <p className="text-xs text-slate-600">{qrLastResult}</p>}
          </div>
        )}
        </CardContent>
      </Card>

      <Card className="rounded-3xl">
        <CardContent className="space-y-4 p-5 md:p-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-lg font-black text-gray-900">Absensi Manual (Utama)</h2>
          <Button
            onClick={handleSaveManualAttendance}
            disabled={savingAttendance || !agendaSubmitted || !currentSession}
            size="sm"
            className="uppercase tracking-wide"
          >
            {savingAttendance ? 'Menyimpan...' : 'Simpan Absensi Manual'}
          </Button>
          <Button
            onClick={() => handleFlushSyncQueue({ showSuccessAlert: true })}
            disabled={syncingQueue || syncSummary.total === 0}
            size="sm"
            variant="secondary"
            className="uppercase tracking-wide"
          >
            {syncingQueue ? 'Sinkronisasi...' : `Sinkron Offline (${syncSummary.total})`}
          </Button>
        </div>
        {syncSummary.total > 0 && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
            Ada {syncSummary.total} item pending sinkronisasi ({syncSummary.attendance} absensi, {syncSummary.score} nilai).
          </p>
        )}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
          <div className="rounded-lg bg-blue-600 px-3 py-2 font-bold text-white">H: {attendanceSummary.H}</div>
          <div className="rounded-lg bg-green-600 px-3 py-2 font-bold text-white">S: {attendanceSummary.S}</div>
          <div className="rounded-lg bg-amber-500 px-3 py-2 font-bold text-white">I: {attendanceSummary.I}</div>
          <div className="rounded-lg bg-rose-600 px-3 py-2 font-bold text-white">A: {attendanceSummary.A}</div>
          <div className="rounded-lg bg-slate-700 px-3 py-2 font-bold text-white">
            Terisi: {attendanceSummary.filled}/{students.length}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari nama/NIS siswa"
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold"
          >
            <option value="all">Semua status</option>
            <option value="H">Hadir (H)</option>
            <option value="S">Sakit (S)</option>
            <option value="I">Izin (I)</option>
            <option value="A">Alpha (A)</option>
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          {['H', 'S', 'I', 'A'].map((statusCode) => (
            <button
              key={`bulk-${statusCode}`}
              onClick={() => applyStatusToVisible(statusCode)}
              disabled={!agendaSubmitted || filteredStudents.length === 0}
              className={`px-3 py-2 rounded-lg font-black text-[11px] uppercase tracking-wide disabled:opacity-50 ${statusTone[statusCode]}`}
            >
              Set Semua ({statusCode})
            </button>
          ))}
          <button
            onClick={clearVisibleDraft}
            disabled={!agendaSubmitted || filteredStudents.length === 0}
            className="px-3 py-2 rounded-lg bg-red-50 text-red-700 font-black text-[11px] uppercase tracking-wide disabled:opacity-50"
          >
            Clear Visible
          </button>
        </div>

        {!agendaSubmitted && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-xl p-3">
            Absensi manual dikunci sampai agenda disubmit.
          </p>
        )}

        {agendaSubmitted && students.length === 0 && (
          <p className="text-sm text-gray-500">Belum ada siswa aktif di kelas jadwal ini.</p>
        )}

        {agendaSubmitted && students.length > 0 && (
          <div className="space-y-2">
            {filteredStudents.map((student) => (
              <div
                key={student.id}
                className="flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50"
              >
                <div>
                  <p className="font-bold text-sm text-gray-800">{student.nama_siswa}</p>
                  <p className="text-[11px] text-gray-500">NIS: {student.nis || '-'}</p>
                </div>
                <div className="flex gap-1">
                  {['H', 'S', 'I', 'A'].map((statusCode) => (
                    <button
                      key={statusCode}
                      onClick={() => pickManualStatus(student.id, statusCode)}
                      className={`w-8 h-8 rounded-lg text-xs font-black border ${
                        attendanceDraft[student.id] === statusCode
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-200'
                      }`}
                    >
                      {statusCode}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {filteredStudents.length === 0 && (
              <p className="text-sm text-gray-500">Tidak ada siswa sesuai filter.</p>
            )}
          </div>
        )}
        </CardContent>
      </Card>
    </PageContainer>
  );
};

export default MapelSessionPage;
