import React, { useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';

import ScheduleForm from '../components/ScheduleForm';
import ScheduleTable from '../components/ScheduleTable';
import {
  createSchedule,
  deleteSchedule,
  fetchMasterMapel,
  fetchSchedulesByGuru,
  updateSchedule,
} from '../../../services/mapelService';
import { fetchMasterKelas } from '../../../services/piketService';

const MapelSchedulePage = ({ user }) => {
  const [kelasOptions, setKelasOptions] = useState([]);
  const [mapelOptions, setMapelOptions] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const guruId = user?.id;

  const hasGuruIdentity = useMemo(() => guruId !== undefined && guruId !== null, [guruId]);

  const loadPageData = async () => {
    if (!hasGuruIdentity) return;

    const [kelasData, mapelData, scheduleData] = await Promise.all([
      fetchMasterKelas(),
      fetchMasterMapel(),
      fetchSchedulesByGuru(guruId),
    ]);

    setKelasOptions(kelasData);
    setMapelOptions(mapelData);
    setSchedules(scheduleData);
  };

  useEffect(() => {
    loadPageData().catch((error) => {
      Swal.fire('Gagal', error.message, 'error');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guruId, hasGuruIdentity]);

  const handleSubmit = async (payload) => {
    if (!hasGuruIdentity) {
      Swal.fire('Gagal', 'Identitas guru tidak tersedia. Silakan login ulang.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      if (editingSchedule) {
        await updateSchedule(editingSchedule.id, payload);
      } else {
        await createSchedule({ ...payload, guruId });
      }

      await loadPageData();
      setEditingSchedule(null);
      Swal.fire('Berhasil', 'Jadwal berhasil disimpan.', 'success');
    } catch (error) {
      Swal.fire('Gagal', error.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (scheduleId) => {
    const result = await Swal.fire({
      title: 'Hapus jadwal ini?',
      text: 'Data terkait sesi akan terdampak jika jadwal dihapus.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ya, Hapus',
      confirmButtonColor: '#dc2626',
    });
    if (!result.isConfirmed) return;

    setDeletingId(scheduleId);
    try {
      await deleteSchedule(scheduleId);
      await loadPageData();
      if (editingSchedule?.id === scheduleId) {
        setEditingSchedule(null);
      }
      Swal.fire('Berhasil', 'Jadwal berhasil dihapus.', 'success');
    } catch (error) {
      Swal.fire('Gagal', error.message, 'error');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <section className="max-w-6xl mx-auto p-4 md:p-8 space-y-5">
      <header>
        <h1 className="text-2xl md:text-3xl font-black text-gray-900">Jadwal Mandiri Guru Mapel</h1>
        <p className="text-gray-500 mt-2">
          Atur jadwal KBM per hari. Sistem otomatis menolak slot bentrok untuk guru yang sama.
        </p>
      </header>

      <ScheduleForm
        key={editingSchedule?.id ?? 'new-schedule'}
        kelasOptions={kelasOptions}
        mapelOptions={mapelOptions}
        initialValue={editingSchedule}
        onSubmit={handleSubmit}
        onCancel={() => setEditingSchedule(null)}
        loading={isSubmitting}
      />

      <ScheduleTable
        schedules={schedules}
        onEdit={setEditingSchedule}
        onDelete={handleDelete}
        deletingId={deletingId}
      />
    </section>
  );
};

export default MapelSchedulePage;
