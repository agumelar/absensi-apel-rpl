import React, { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';

import {
  PEMBIASAAN_WEEKDAYS,
  fetchPembiasaanParticipantOptions,
  fetchSapaPagiScheduleByDay,
  fetchSapaPagiWeeklySchedule,
  saveSapaPagiScheduleByDay,
} from '../../../services/pembiasaanService';
import {
  buildHighlightParts,
  filterParticipantsByKeyword,
  sortParticipantsBySelection,
} from '../utils/sapaScheduleRules';
import Button from '../../../shared/ui/Button';
import Card, { CardContent } from '../../../shared/ui/Card';
import { PageContainer, PageHeader, PageSubtitle, PageTitle } from '../../../shared/ui/PageLayout';

const AdminSapaPagiSchedulePage = () => {
  const [hari, setHari] = useState('senin');
  const [participants, setParticipants] = useState([]);
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [search, setSearch] = useState('');
  const [savedInfo, setSavedInfo] = useState('');
  const [weeklyScheduleMap, setWeeklyScheduleMap] = useState({});
  const [loadingWeekly, setLoadingWeekly] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadWeeklySchedule = async () => {
    try {
      setLoadingWeekly(true);
      const grouped = await fetchSapaPagiWeeklySchedule();
      setWeeklyScheduleMap(grouped || {});
    } catch (error) {
      Swal.fire('Gagal', error.message, 'error');
    } finally {
      setLoadingWeekly(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const [allParticipants, currentSchedule] = await Promise.all([
          fetchPembiasaanParticipantOptions(),
          fetchSapaPagiScheduleByDay({ hari }),
        ]);
        setParticipants(allParticipants);
        setSelectedUserIds((currentSchedule || []).map((item) => String(item.user_id)));
      } catch (error) {
        Swal.fire('Gagal', error.message, 'error');
      }
    };
    load();
  }, [hari]);

  useEffect(() => {
    loadWeeklySchedule();
  }, []);

  const options = useMemo(
    () => sortParticipantsBySelection(filterParticipantsByKeyword(participants, search), selectedUserIds),
    [participants, search, selectedUserIds],
  );

  const toggleUser = (userId) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((item) => item !== userId) : [...prev, userId],
    );
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await saveSapaPagiScheduleByDay({ hari, userIds: selectedUserIds });
      await loadWeeklySchedule();
      const dayLabel = PEMBIASAAN_WEEKDAYS.find((item) => item.value === hari)?.label || hari;
      setSavedInfo(`Jadwal tersimpan untuk hari ${dayLabel}.`);
      Swal.fire('Berhasil', 'Jadwal sapa pagi tersimpan.', 'success');
    } catch (error) {
      Swal.fire('Gagal', error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSelectAllFiltered = () => {
    const filteredIds = options.map((item) => String(item.id));
    setSelectedUserIds((prev) => [...new Set([...prev, ...filteredIds])]);
  };

  const handleClearSelection = () => {
    setSelectedUserIds([]);
  };

  const renderHighlighted = (text) => {
    const parts = buildHighlightParts(text, search);
    return parts.map((part, index) =>
      part.match ? (
        <mark key={`${text}-${index}`} className="rounded bg-amber-200 px-0.5 text-slate-900">
          {part.text}
        </mark>
      ) : (
        <span key={`${text}-${index}`}>{part.text}</span>
      ),
    );
  };

  return (
    <PageContainer className="space-y-5">
      <PageHeader className="block">
        <PageTitle className="text-3xl">Admin · Jadwal Sapa Pagi</PageTitle>
        <PageSubtitle className="mt-2">Pilih petugas sapa pagi per hari dari user terdaftar.</PageSubtitle>
      </PageHeader>

      <Card>
        <CardContent className="space-y-3 p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Ringkasan Jadwal Mingguan (Senin-Jumat)</p>
          {loadingWeekly ? (
            <p className="text-sm text-slate-500">Memuat ringkasan jadwal...</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {PEMBIASAAN_WEEKDAYS.map((day) => {
                const entries = weeklyScheduleMap?.[day.value] || [];
                return (
                  <div key={day.value} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-black text-slate-700">{day.label}</p>
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                        {entries.length} petugas
                      </span>
                    </div>
                    {entries.length === 0 ? (
                      <p className="text-xs text-slate-500">Belum ada petugas.</p>
                    ) : (
                      <div className="space-y-1">
                        {entries.map((item) => (
                          <p key={item.id} className="text-xs font-semibold text-slate-700">
                            {item.walikelas?.nama_lengkap || '-'}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-5">
          <label className="block text-xs font-bold text-slate-600">
            Hari
            <select
              value={hari}
              onChange={(event) => setHari(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
            >
              {PEMBIASAAN_WEEKDAYS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <div className="max-h-[420px] space-y-2 overflow-auto rounded-lg border border-slate-200 p-3">
            <label className="block text-xs font-bold text-slate-600">
              Cari Nama / Role
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Contoh: rina / guru / tu"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
              />
            </label>

            {savedInfo && (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                {savedInfo}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleSelectAllFiltered}
                className="rounded-lg bg-blue-50 px-3 py-1.5 text-[11px] font-bold text-blue-700"
              >
                Pilih Semua Hasil ({options.length})
              </button>
              <button
                type="button"
                onClick={handleClearSelection}
                className="rounded-lg bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-700"
              >
                Kosongkan Pilihan
              </button>
            </div>

            {options.map((user) => {
              const userId = String(user.id);
              const checked = selectedUserIds.includes(userId);
              return (
                <label key={userId} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs">
                  <input type="checkbox" checked={checked} onChange={() => toggleUser(userId)} className="h-4 w-4" />
                  <span className="font-semibold text-slate-700">{renderHighlighted(user.nama_lengkap)}</span>
                  <span className="ml-auto rounded-full bg-slate-200 px-2 py-0.5 text-[10px] uppercase text-slate-600">
                    {renderHighlighted(user.role)}
                  </span>
                </label>
              );
            })}
            {options.length === 0 && (
              <p className="rounded-lg bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">
                Tidak ada user yang cocok dengan pencarian.
              </p>
            )}
          </div>

          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Menyimpan...' : 'Simpan Jadwal'}
          </Button>
        </CardContent>
      </Card>
    </PageContainer>
  );
};

export default AdminSapaPagiSchedulePage;
