import React, { useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { Plus, Trash2, Loader2 } from 'lucide-react';

import { supabase } from '../../../supabaseClient';
import Button from '../../../shared/ui/Button';
import Card, { CardContent } from '../../../shared/ui/Card';
import { PageContainer, PageHeader, PageSubtitle, PageTitle } from '../../../shared/ui/PageLayout';

const AdminSchoolCalendarPage = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ tanggal: '', is_libur: true, keterangan: '' });

  const fetchRows = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('school_calendar')
        .select('id, tanggal, is_libur, keterangan, updated_at')
        .order('tanggal', { ascending: true });
      if (error) throw error;
      setRows(data || []);
    } catch (error) {
      Swal.fire('Gagal', error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, []);

  const handleCreate = async () => {
    if (!form.tanggal) {
      Swal.fire('Validasi', 'Tanggal wajib diisi.', 'warning');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        tanggal: form.tanggal,
        is_libur: Boolean(form.is_libur),
        keterangan: String(form.keterangan || '').trim() || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('school_calendar').upsert(payload, { onConflict: 'tanggal' });
      if (error) throw error;

      setForm({ tanggal: '', is_libur: true, keterangan: '' });
      await fetchRows();
      Swal.fire('Berhasil', 'Kalender sekolah diperbarui.', 'success');
    } catch (error) {
      Swal.fire('Gagal', error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    const confirm = await Swal.fire({
      title: 'Hapus tanggal ini?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
    });

    if (!confirm.isConfirmed) return;

    try {
      const { error } = await supabase.from('school_calendar').delete().eq('id', id);
      if (error) throw error;
      await fetchRows();
    } catch (error) {
      Swal.fire('Gagal', error.message, 'error');
    }
  };

  return (
    <PageContainer className="space-y-5">
      <PageHeader className="block">
        <PageTitle className="text-3xl">Admin · Kalender Sekolah</PageTitle>
        <PageSubtitle className="mt-2">Kelola hari libur/non-aktif sekolah sebagai acuan seluruh modul absensi.</PageSubtitle>
      </PageHeader>

      <Card>
        <CardContent className="grid grid-cols-1 gap-4 p-5 md:grid-cols-4">
          <label className="text-xs font-bold text-slate-600">
            Tanggal
            <input
              type="date"
              value={form.tanggal}
              onChange={(event) => setForm((prev) => ({ ...prev, tanggal: event.target.value }))}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
            />
          </label>

          <label className="text-xs font-bold text-slate-600">
            Status
            <select
              value={form.is_libur ? 'libur' : 'aktif'}
              onChange={(event) => setForm((prev) => ({ ...prev, is_libur: event.target.value === 'libur' }))}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
            >
              <option value="libur">Libur</option>
              <option value="aktif">Aktif</option>
            </select>
          </label>

          <label className="text-xs font-bold text-slate-600 md:col-span-2">
            Keterangan
            <input
              value={form.keterangan}
              onChange={(event) => setForm((prev) => ({ ...prev, keterangan: event.target.value }))}
              placeholder="Contoh: Libur Semester / Kegiatan Sekolah"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
            />
          </label>

          <div className="md:col-span-4">
            <Button onClick={handleCreate} disabled={saving}>
              <Plus size={16} /> {saving ? 'Menyimpan...' : 'Simpan Tanggal'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-xs">
              <thead className="bg-slate-50 text-[11px] uppercase text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left">Tanggal</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Keterangan</th>
                  <th className="px-3 py-2 text-left">Updated At</th>
                  <th className="px-3 py-2 text-left">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                      <Loader2 className="mx-auto animate-spin" />
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                      Belum ada tanggal pada kalender sekolah.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100">
                      <td className="px-3 py-2">{row.tanggal}</td>
                      <td className="px-3 py-2">{row.is_libur ? 'Libur' : 'Aktif'}</td>
                      <td className="px-3 py-2">{row.keterangan || '-'}</td>
                      <td className="px-3 py-2">{row.updated_at ? String(row.updated_at).replace('T', ' ').slice(0, 16) : '-'}</td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => handleDelete(row.id)}
                          className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"
                          title="Hapus"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
};

export default AdminSchoolCalendarPage;
