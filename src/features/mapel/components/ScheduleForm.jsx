import React, { useState } from 'react';

const DAY_OPTIONS = [
  { value: 'Senin', label: 'Senin' },
  { value: 'Selasa', label: 'Selasa' },
  { value: 'Rabu', label: 'Rabu' },
  { value: 'Kamis', label: 'Kamis' },
  { value: 'Jumat', label: 'Jumat' },
  { value: 'Sabtu', label: 'Sabtu' },
];

const initialFormState = {
  kelasId: '',
  mapelId: '',
  hari: 'Senin',
  jamMulai: '',
  jamSelesai: '',
};

const ScheduleForm = ({ kelasOptions, mapelOptions, initialValue, onSubmit, onCancel, loading }) => {
  const [form, setForm] = useState(() =>
    initialValue
      ? {
          kelasId: String(initialValue.kelas_id ?? ''),
          mapelId: String(initialValue.mapel_id ?? ''),
          hari: initialValue.hari ?? 'Senin',
          jamMulai: String(initialValue.jam_mulai ?? '').slice(0, 5),
          jamSelesai: String(initialValue.jam_selesai ?? '').slice(0, 5),
        }
      : initialFormState,
  );

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit({
      kelasId: Number.parseInt(form.kelasId, 10),
      mapelId: Number.parseInt(form.mapelId, 10),
      hari: form.hari,
      jamMulai: form.jamMulai,
      jamSelesai: form.jamSelesai,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-gray-100 rounded-3xl p-5 md:p-6 shadow-sm">
      <h2 className="text-lg font-black text-gray-900">
        {initialValue ? 'Ubah Jadwal Mengajar' : 'Tambah Jadwal Mengajar'}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <label className="text-sm font-bold text-gray-600">
          Kelas
          <select
            className="w-full mt-1 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 font-semibold"
            value={form.kelasId}
            onChange={(e) => handleChange('kelasId', e.target.value)}
            required
          >
            <option value="">Pilih kelas</option>
            {kelasOptions.map((kelas) => (
              <option key={kelas.id} value={kelas.id}>
                {kelas.nama_kelas}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-bold text-gray-600">
          Mata Pelajaran
          <select
            className="w-full mt-1 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 font-semibold"
            value={form.mapelId}
            onChange={(e) => handleChange('mapelId', e.target.value)}
            required
          >
            <option value="">Pilih mapel</option>
            {mapelOptions.map((mapel) => (
              <option key={mapel.id} value={mapel.id}>
                {mapel.nama_mapel}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm font-bold text-gray-600">
          Hari
          <select
            className="w-full mt-1 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 font-semibold"
            value={form.hari}
            onChange={(e) => handleChange('hari', e.target.value)}
            required
          >
            {DAY_OPTIONS.map((day) => (
              <option key={day.value} value={day.value}>
                {day.label}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm font-bold text-gray-600">
            Jam Mulai
            <input
              type="time"
              className="w-full mt-1 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 font-semibold"
              value={form.jamMulai}
              onChange={(e) => handleChange('jamMulai', e.target.value)}
              required
            />
          </label>

          <label className="text-sm font-bold text-gray-600">
            Jam Selesai
            <input
              type="time"
              className="w-full mt-1 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 font-semibold"
              value={form.jamSelesai}
              onChange={(e) => handleChange('jamSelesai', e.target.value)}
              required
            />
          </label>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-5">
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 rounded-xl bg-blue-600 text-white font-black text-xs uppercase tracking-wide"
        >
          {loading ? 'Menyimpan...' : initialValue ? 'Update Jadwal' : 'Simpan Jadwal'}
        </button>
        {initialValue && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 font-black text-xs uppercase tracking-wide"
          >
            Batal Edit
          </button>
        )}
      </div>
    </form>
  );
};

export default ScheduleForm;
