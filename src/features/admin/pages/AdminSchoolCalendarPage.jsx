import React, { useEffect, useRef, useState } from 'react';
import Swal from 'sweetalert2';
import { Plus, Trash2, Loader2, Download, Upload, FileSpreadsheet, X } from 'lucide-react';

import { supabase } from '../../../supabaseClient';
import Button from '../../../shared/ui/Button';
import Card, { CardContent } from '../../../shared/ui/Card';
import { PageContainer, PageHeader, PageSubtitle, PageTitle } from '../../../shared/ui/PageLayout';
import {
  validateRangeRows,
  expandRangesToDailyRecords,
  buildPreviewModel,
} from '../utils/calendarUploadRules';
import { fetchExistingCalendarDates, batchUpsertSchoolCalendar } from '../../../services/schoolCalendarService';
import { downloadKalenderTemplate, readExcelFileToJson } from '../../../services/shared/excelService';

const ALLOWED_EXTENSIONS = ['xlsx', 'csv'];

const getFileExtension = (name) => String(name || '').split('.').pop()?.toLowerCase() || '';

const AdminSchoolCalendarPage = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ tanggal: '', is_libur: true, keterangan: '' });

  // State fitur unggah kalender.
  const [uploadBusy, setUploadBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const fileInputRef = useRef(null);

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

  const handleDownloadTemplate = async () => {
    try {
      await downloadKalenderTemplate();
    } catch (error) {
      Swal.fire('Gagal Unduh Template', error.message || 'Template gagal diunduh. Coba lagi.', 'error');
    }
  };

  const handleFileSelected = async (event) => {
    const file = event.target.files?.[0];
    // Reset input agar berkas yang sama bisa dipilih ulang.
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;

    const ext = getFileExtension(file.name);
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      Swal.fire(
        'Format Tidak Didukung',
        'Format berkas tidak didukung. Unggah berkas Excel (.xlsx) atau CSV (.csv).',
        'error',
      );
      return;
    }

    try {
      setUploadBusy(true);

      const rawRows = await readExcelFileToJson(file);
      if (!Array.isArray(rawRows) || rawRows.length === 0) {
        Swal.fire('Berkas Kosong', 'Berkas tidak berisi data tanggal. Periksa kembali isi berkas.', 'warning');
        return;
      }

      const { rows: validRows, errors } = validateRangeRows(rawRows);
      if (errors.length > 0) {
        Swal.fire({
          icon: 'error',
          title: 'Isi Berkas Tidak Valid',
          html: `<div style="text-align:left;max-height:260px;overflow:auto"><ul style="padding-left:1.1rem;margin:0">${errors
            .map((e) => `<li>${e}</li>`)
            .join('')}</ul></div>`,
        });
        return;
      }

      const { records, usedSystemTZFallback } = expandRangesToDailyRecords(validRows);
      if (records.length === 0) {
        Swal.fire(
          'Tidak Ada Hari Libur',
          'Setelah memproses berkas, tidak ada hari kerja yang bisa ditandai libur (mungkin seluruhnya jatuh di akhir pekan).',
          'warning',
        );
        return;
      }

      if (usedSystemTZFallback) {
        await Swal.fire({
          icon: 'warning',
          title: 'Peringatan Zona Waktu',
          text: 'Perhitungan tanggal memakai zona waktu sistem (WIB tidak tersedia). Periksa hasil pratinjau dengan teliti.',
        });
      }

      const minDate = records[0].tanggal;
      const maxDate = records[records.length - 1].tanggal;
      const existingSet = await fetchExistingCalendarDates({ minDate, maxDate });
      const previewModel = buildPreviewModel(records, existingSet);
      setPreview(previewModel);
    } catch (error) {
      Swal.fire('Gagal Memproses Berkas', error.message || 'Terjadi kesalahan saat membaca berkas.', 'error');
    } finally {
      setUploadBusy(false);
    }
  };

  const handleConfirmSave = async () => {
    if (!preview) return;
    try {
      setConfirming(true);
      const dailyRecords = preview.items.map((item) => ({
        tanggal: item.tanggal,
        is_libur: true,
        keterangan: item.keterangan ?? null,
      }));
      const { writtenCount } = await batchUpsertSchoolCalendar({ dailyRecords });
      await fetchRows();
      setPreview(null);
      Swal.fire('Berhasil', `${writtenCount} tanggal libur berhasil disimpan ke kalender sekolah.`, 'success');
    } catch (error) {
      // Pertahankan preview agar admin bisa mengulang konfirmasi tanpa unggah ulang.
      Swal.fire('Gagal Menyimpan', error.message || 'Penyimpanan gagal. Silakan coba lagi.', 'error');
    } finally {
      setConfirming(false);
    }
  };

  const handleCancelPreview = () => {
    setPreview(null);
  };

  return (
    <PageContainer className="space-y-5">
      <PageHeader className="block">
        <PageTitle className="text-3xl">Admin · Kalender Sekolah</PageTitle>
        <PageSubtitle className="mt-2">Kelola hari libur/non-aktif sekolah sebagai acuan seluruh modul absensi.</PageSubtitle>
      </PageHeader>

      {/* Unggah Kalender Pendidikan */}
      <Card>
        <CardContent className="space-y-4 p-5">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Unggah Kalender Pendidikan</h3>
            <p className="mt-1 text-xs text-slate-500">
              Unduh template, isi rentang hari libur (kolom <span className="font-semibold">tanggal_mulai</span>,{' '}
              <span className="font-semibold">tanggal_selesai</span>, <span className="font-semibold">keterangan</span>),
              lalu unggah untuk menandai hari libur secara massal. Akhir pekan otomatis libur, jadi cukup isi libur hari kerja.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button variant="secondary" onClick={handleDownloadTemplate} disabled={uploadBusy || confirming}>
              <Download size={16} /> Unduh Template
            </Button>

            <input
              ref={fileInputRef}
              id="calendar-upload-input"
              type="file"
              accept=".xlsx,.csv"
              onChange={handleFileSelected}
              disabled={uploadBusy || confirming}
              className="hidden"
              aria-label="Unggah berkas kalender pendidikan (.xlsx atau .csv)"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadBusy || confirming}
              aria-controls="calendar-upload-input"
            >
              {uploadBusy ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {uploadBusy ? 'Memproses...' : 'Unggah Berkas'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Form manual (dipertahankan untuk koreksi kecil) */}
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

      {/* Preview Panel */}
      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-2">
                <FileSpreadsheet size={18} className="text-blue-600" />
                <h3 className="text-sm font-bold text-slate-800">Pratinjau Hari Libur</h3>
              </div>
              <button
                onClick={handleCancelPreview}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"
                aria-label="Tutup pratinjau"
                disabled={confirming}
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-wrap gap-3 border-b border-slate-100 px-5 py-3 text-xs">
              <span className="rounded-lg bg-slate-100 px-3 py-1.5 font-semibold text-slate-700">
                Total: {preview.totalCount}
              </span>
              <span className="rounded-lg bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-700">
                Baru: {preview.newCount}
              </span>
              <span className="rounded-lg bg-amber-50 px-3 py-1.5 font-semibold text-amber-700">
                Timpa: {preview.overwriteCount}
              </span>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white text-[11px] uppercase text-slate-500">
                  <tr>
                    <th className="py-2 text-left">Tanggal</th>
                    <th className="py-2 text-left">Keterangan</th>
                    <th className="py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.items.map((item) => (
                    <tr key={item.tanggal} className="border-t border-slate-100">
                      <td className="py-2">{item.tanggal}</td>
                      <td className="py-2">{item.keterangan || '-'}</td>
                      <td className="py-2">
                        {item.status === 'overwrite' ? (
                          <span className="rounded-md bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">Timpa</span>
                        ) : (
                          <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">Baru</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-4">
              <Button variant="secondary" onClick={handleCancelPreview} disabled={confirming}>
                Batal
              </Button>
              <Button onClick={handleConfirmSave} disabled={confirming}>
                {confirming ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                {confirming ? 'Menyimpan...' : 'Konfirmasi Simpan'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
};

export default AdminSchoolCalendarPage;
