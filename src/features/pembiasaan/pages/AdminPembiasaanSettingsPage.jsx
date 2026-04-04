import React, { useEffect, useState } from 'react';
import Swal from 'sweetalert2';

import { fetchPembiasaanSettings, savePembiasaanSettings } from '../../../services/pembiasaanService';
import Button from '../../../shared/ui/Button';
import Card, { CardContent } from '../../../shared/ui/Card';
import { PageContainer, PageHeader, PageSubtitle, PageTitle } from '../../../shared/ui/PageLayout';

const AdminPembiasaanSettingsPage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    school_name: 'SMK',
    school_lat: '',
    school_lng: '',
    radius_meter: 200,
    cutoff_sapa_pagi: '06:30:00',
    cutoff_pembiasaan: '07:00:00',
    photo_retention_days: 30,
  });

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const data = await fetchPembiasaanSettings();
        if (data) setForm(data);
      } catch (error) {
        Swal.fire('Gagal', error.message, 'error');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    try {
      setSaving(true);
      await savePembiasaanSettings(form);
      Swal.fire('Berhasil', 'Pengaturan pembiasaan disimpan.', 'success');
    } catch (error) {
      Swal.fire('Gagal', error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer className="space-y-5">
      <PageHeader className="block">
        <PageTitle className="text-3xl">Admin · Pengaturan Pembiasaan</PageTitle>
        <PageSubtitle className="mt-2">Atur titik sekolah, radius, cutoff, dan retensi foto.</PageSubtitle>
      </PageHeader>

      <Card>
        <CardContent className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
          <label className="text-xs font-bold text-slate-600">
            Nama Sekolah
            <input
              value={form.school_name || ''}
              onChange={(event) => setField('school_name', event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
            />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Radius (meter)
            <input
              type="number"
              value={form.radius_meter || 200}
              onChange={(event) => setField('radius_meter', event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
            />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Latitude Sekolah
            <input
              type="number"
              step="0.0000001"
              value={form.school_lat || ''}
              onChange={(event) => setField('school_lat', event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
            />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Longitude Sekolah
            <input
              type="number"
              step="0.0000001"
              value={form.school_lng || ''}
              onChange={(event) => setField('school_lng', event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
            />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Cutoff Sapa Pagi
            <input
              type="time"
              value={String(form.cutoff_sapa_pagi || '06:30:00').slice(0, 5)}
              onChange={(event) => setField('cutoff_sapa_pagi', `${event.target.value}:00`)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
            />
          </label>
          <label className="text-xs font-bold text-slate-600">
            Cutoff Pembiasaan
            <input
              type="time"
              value={String(form.cutoff_pembiasaan || '07:00:00').slice(0, 5)}
              onChange={(event) => setField('cutoff_pembiasaan', `${event.target.value}:00`)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
            />
          </label>
          <label className="text-xs font-bold text-slate-600 md:col-span-2">
            Retensi Foto (hari)
            <input
              type="number"
              value={form.photo_retention_days || 30}
              onChange={(event) => setField('photo_retention_days', event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
            />
          </label>

          <div className="md:col-span-2">
            <Button onClick={handleSave} disabled={loading || saving}>
              {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
};

export default AdminPembiasaanSettingsPage;
