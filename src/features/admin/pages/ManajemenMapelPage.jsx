import React, { useEffect, useState } from 'react';
import { BookOpen, Download, Edit3, FileUp, Loader2, Plus, Save, Trash2, X } from 'lucide-react';
import Swal from 'sweetalert2';

import { supabase } from '../../../supabaseClient';
import { exportJsonToExcel, readExcelFileToJson } from '../../../services/shared/excelService';
import Button from '../../../shared/ui/Button';
import Card, { CardContent } from '../../../shared/ui/Card';
import { PageContainer, PageHeader, PageSubtitle, PageTitle } from '../../../shared/ui/PageLayout';

const EMPTY_FORM = {
  nama_mapel: '',
  kode_mapel: '',
};

const ManajemenMapelPage = () => {
  const [mapelRows, setMapelRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const loadMapel = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('master_mapel')
        .select('id, nama_mapel, kode_mapel')
        .order('nama_mapel', { ascending: true });

      if (error) throw error;
      setMapelRows(data || []);
    } catch (error) {
      Swal.fire('Gagal', error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMapel();
  }, []);

  const openCreateForm = () => {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setIsFormOpen(true);
  };

  const openEditForm = (row) => {
    setEditingId(row.id);
    setFormData({
      nama_mapel: row.nama_mapel || '',
      kode_mapel: row.kode_mapel || '',
    });
    setIsFormOpen(true);
  };

  const handleCancel = () => {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setIsFormOpen(false);
  };

  const handleSave = async () => {
    if (!formData.nama_mapel.trim()) {
      Swal.fire('Oops!', 'Nama mata pelajaran wajib diisi.', 'warning');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        nama_mapel: formData.nama_mapel.trim().toUpperCase(),
        kode_mapel: formData.kode_mapel.trim().toUpperCase() || null,
      };

      if (editingId) {
        const { error } = await supabase.from('master_mapel').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('master_mapel').insert([payload]);
        if (error) throw error;
      }

      Swal.fire('Berhasil', `Data mapel ${editingId ? 'diperbarui' : 'ditambahkan'}.`, 'success');
      handleCancel();
      await loadMapel();
    } catch (error) {
      Swal.fire('Gagal', error.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'Hapus mata pelajaran?',
      text: 'Pastikan mapel ini tidak dipakai di jadwal.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
    });
    if (!result.isConfirmed) return;

    const { error } = await supabase.from('master_mapel').delete().eq('id', id);
    if (error) {
      Swal.fire('Gagal', 'Mapel masih terhubung ke data jadwal.', 'error');
      return;
    }

    await loadMapel();
  };

  const handleDownloadTemplate = async () => {
    await exportJsonToExcel({
      rows: [
        { nama_mapel: 'PEMROGRAMAN WEB', kode_mapel: 'PWEB' },
        { nama_mapel: 'BASIS DATA', kode_mapel: 'BD' },
      ],
      sheetName: 'template_mapel',
      fileName: 'template_import_mapel.xlsx',
    });
  };

  const handleImportMapel = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      Swal.fire('Format tidak didukung', 'Gunakan file .xlsx untuk import mapel.', 'warning');
      return;
    }

    setIsImporting(true);
    try {
      const rows = await readExcelFileToJson(file);
      const normalizedRows = [];
      const errorLog = [];
      const seenKeys = new Set();

      rows.forEach((row, idx) => {
        const namaMapel = String(row.nama_mapel || '').trim().toUpperCase();
        const kodeMapel = String(row.kode_mapel || '').trim().toUpperCase();
        if (!namaMapel) {
          errorLog.push(`Baris ${idx + 2}: kolom nama_mapel wajib diisi.`);
          return;
        }

        const uniqueKey = kodeMapel ? `kode:${kodeMapel}` : `nama:${namaMapel}`;
        if (seenKeys.has(uniqueKey)) return;
        seenKeys.add(uniqueKey);

        normalizedRows.push({
          nama_mapel: namaMapel,
          kode_mapel: kodeMapel || null,
        });
      });

      if (errorLog.length > 0) {
        await Swal.fire({
          title: 'Template tidak valid',
          html: `<div class="text-left text-[10px] bg-red-50 p-3 rounded-xl font-mono text-red-600">${errorLog.join('<br/>')}</div>`,
          icon: 'error',
        });
        return;
      }

      if (normalizedRows.length === 0) {
        await Swal.fire('Tidak ada data', 'File import tidak berisi data mapel valid.', 'warning');
        return;
      }

      const { data: existingRows, error: existingError } = await supabase
        .from('master_mapel')
        .select('id, nama_mapel, kode_mapel');
      if (existingError) throw existingError;

      const existingByKode = new Map();
      const existingByNama = new Map();
      (existingRows || []).forEach((item) => {
        const code = String(item.kode_mapel || '').trim().toUpperCase();
        const name = String(item.nama_mapel || '').trim().toUpperCase();
        if (code) existingByKode.set(code, item);
        if (name) existingByNama.set(name, item);
      });

      const inserts = [];
      const updates = [];
      normalizedRows.forEach((payload) => {
        const existing = payload.kode_mapel
          ? existingByKode.get(payload.kode_mapel)
          : existingByNama.get(payload.nama_mapel);

        if (existing?.id) {
          updates.push({ id: existing.id, payload });
        } else {
          inserts.push(payload);
        }
      });

      if (updates.length > 0) {
        const updateResults = await Promise.all(
          updates.map(({ id, payload }) => supabase.from('master_mapel').update(payload).eq('id', id))
        );
        const failedUpdate = updateResults.find((result) => result.error);
        if (failedUpdate?.error) throw failedUpdate.error;
      }

      if (inserts.length > 0) {
        const { error } = await supabase.from('master_mapel').insert(inserts);
        if (error) throw error;
      }

      await loadMapel();
      await Swal.fire(
        'Berhasil',
        `${normalizedRows.length} baris diproses (${updates.length} update, ${inserts.length} tambah).`,
        'success'
      );
    } catch (error) {
      await Swal.fire('Gagal import', error.message, 'error');
    } finally {
      setIsImporting(false);
      e.target.value = null;
    }
  };

  return (
    <PageContainer className="max-w-5xl">
      <PageHeader className="mb-8">
        <div>
          <PageTitle className="text-3xl italic uppercase">Manajemen Mata Pelajaran</PageTitle>
          <PageSubtitle className="mt-2">Total {mapelRows.length} mata pelajaran terdaftar</PageSubtitle>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" onClick={handleDownloadTemplate} className="text-xs uppercase">
            <Download size={16} /> Template
          </Button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
            {isImporting ? <Loader2 className="animate-spin" size={16} /> : <FileUp size={16} />}
            Import Excel
            <input type="file" className="hidden" accept=".xlsx" onChange={handleImportMapel} />
          </label>
          <Button onClick={isFormOpen ? handleCancel : openCreateForm} className="text-xs uppercase">
            {isFormOpen ? <X size={16} /> : <Plus size={16} />}
            {isFormOpen ? 'Batal' : 'Tambah Mapel'}
          </Button>
        </div>
      </PageHeader>

      {isFormOpen && (
        <Card className="mb-8 rounded-3xl">
          <CardContent className="grid grid-cols-1 gap-5 p-6 md:grid-cols-2 md:p-8">
            <div className="space-y-2 md:col-span-2">
              <label className="ml-2 text-[10px] font-black uppercase text-gray-400">Nama Mata Pelajaran</label>
              <input
                type="text"
                className="w-full rounded-2xl border-2 border-transparent bg-gray-50 px-4 py-4 text-xs font-black uppercase outline-none focus:border-blue-500"
                placeholder="Contoh: PEMROGRAMAN WEB"
                value={formData.nama_mapel}
                onChange={(e) => setFormData({ ...formData, nama_mapel: e.target.value })}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="ml-2 text-[10px] font-black uppercase text-gray-400">Kode Mapel (Opsional)</label>
              <input
                type="text"
                className="w-full rounded-2xl border-2 border-transparent bg-gray-50 px-4 py-4 text-xs font-black uppercase outline-none focus:border-blue-500"
                placeholder="Contoh: PWEB"
                value={formData.kode_mapel}
                onChange={(e) => setFormData({ ...formData, kode_mapel: e.target.value })}
              />
            </div>
            <Button onClick={handleSave} size="lg" className="md:col-span-2" disabled={isSaving}>
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {editingId ? 'Simpan Perubahan' : 'Simpan Mata Pelajaran'}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-3xl overflow-hidden">
        <table className="premium-table text-left">
          <thead>
            <tr className="border-b border-gray-100">
              <th>Mata Pelajaran</th>
              <th>Kode</th>
              <th className="text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr>
                <td colSpan="3" className="p-16 text-center">
                  <Loader2 className="mx-auto mb-3 animate-spin text-blue-600" />
                  <span className="micro-loading">Memuat data mapel...</span>
                </td>
              </tr>
            ) : mapelRows.length === 0 ? (
              <tr>
                <td colSpan="3" className="p-10 text-center text-sm text-slate-500">
                  Belum ada data mata pelajaran.
                </td>
              </tr>
            ) : (
              mapelRows.map((row) => (
                <tr key={row.id} className="group transition-all hover:bg-blue-50/20">
                  <td className="p-6">
                    <div className="flex items-center gap-3">
                      <BookOpen size={16} className="text-blue-500" />
                      <p className="text-xs font-black uppercase text-gray-800">{row.nama_mapel}</p>
                    </div>
                  </td>
                  <td className="p-6">
                    <span className="rounded-full bg-blue-100 px-3 py-1 text-[10px] font-black uppercase italic text-blue-600">
                      {row.kode_mapel || '-'}
                    </span>
                  </td>
                  <td className="space-x-1 p-6 text-right">
                    <button
                      onClick={() => openEditForm(row)}
                      className="p-2 text-gray-300 transition-all hover:text-blue-500"
                    >
                      <Edit3 size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(row.id)}
                      className="p-2 text-gray-300 transition-all hover:text-red-500"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </PageContainer>
  );
};

export default ManajemenMapelPage;
