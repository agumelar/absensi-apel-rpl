import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import { 
  UserPlus, Trash2, Edit3, User, Loader2, X, Save, Fingerprint, FileUp
} from 'lucide-react';
import Swal from 'sweetalert2';
import { readExcelFileToJson } from '../../../services/shared/excelService';
import Button from '../../../shared/ui/Button';
import Card, { CardContent } from '../../../shared/ui/Card';
import InputField from '../../../shared/ui/InputField';
import { PageContainer, PageHeader, PageSubtitle, PageTitle } from '../../../shared/ui/PageLayout';

const toBooleanFlag = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return ['1', 'true', 't', 'yes', 'y'].includes(normalized);
  }

  return false;
};

const ALLOWED_ROLES = ['guru', 'walikelas', 'walas', 'piket', 'admin', 'kaprog', 'kepsek', 'kesiswaan', 'kurikulum'];

const normalizeAllowedRole = (role) => {
  const normalized = String(role || '').trim().toLowerCase();
  if (!normalized) return 'guru';
  return ALLOWED_ROLES.includes(normalized) ? normalized : 'guru';
};

const ManajemenUser = () => {
  const [users, setUsers] = useState([]);
  const [kelas, setKelas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [currentId, setCurrentId] = useState(null);
  
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    nama_lengkap: '',
    role: 'guru',
    kelas_id: '',
    is_guru_mapel: false,
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const { data: userData } = await supabase
        .from('walikelas')
        .select('*, master_kelas(nama_kelas)');
      
      const { data: kelasData } = await supabase.from('master_kelas').select('*').order('nama_kelas');

      setUsers(userData || []);
      setKelas(kelasData || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // FITUR IMPORT EXCEL UNTUK USER/WALAS
  const handleImportUser = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      Swal.fire('Format tidak didukung', 'Gunakan file .xlsx untuk import user.', 'warning');
      return;
    }

    setIsImporting(true);
    try {
      const dataExcel = await readExcelFileToJson(file);

      let finalData = [];
      let errorLog = [];

      dataExcel.forEach((row, index) => {
        const roleRaw = normalizeAllowedRole(row.role);
        const namaKelasRaw = row.kelas?.toString().trim().toUpperCase();
        const isGuruMapelRaw = toBooleanFlag(row.is_guru_mapel ?? row.guru_mapel ?? false);
        
        const klsMatch = kelas.find(k => k.nama_kelas.trim().toUpperCase() === namaKelasRaw);

        if ((roleRaw === 'walikelas' || roleRaw === 'walas') && !klsMatch) {
          errorLog.push(`Baris ${index + 2}: Kelas "${namaKelasRaw}" tidak ditemukan di Master Kelas`);
        } else {
          finalData.push({
            username: row.username?.toString().toLowerCase().trim(),
            password: row.password?.toString() || 'Jingga123',
            nama_lengkap: row.nama_lengkap?.toUpperCase().trim(),
            role: roleRaw,
            kelas_id: klsMatch ? klsMatch.id : null,
            kelas_diampu: klsMatch ? klsMatch.nama_kelas : null,
            is_guru_mapel: isGuruMapelRaw,
          });
        }
      });

      if (errorLog.length > 0) {
        return Swal.fire({
          title: 'Typo Nama Kelas!',
          html: `<div class="text-left text-[10px] bg-red-50 p-3 rounded-xl font-mono text-red-600">
                  ${errorLog.join('<br/>')}
                 </div>`,
          icon: 'error'
        });
      }

      const { error } = await supabase.from('walikelas').upsert(finalData, { onConflict: 'username' });
      if (error) throw error;

      Swal.fire('Berhasil!', `${finalData.length} akun diproses.`, 'success');
      fetchInitialData();
    } catch (err) {
      Swal.fire('Gagal!', err.message, 'error');
    } finally {
      setIsImporting(false);
      e.target.value = null;
    }
  };

  const handleSave = async () => {
    const { username, password, nama_lengkap, role, kelas_id, is_guru_mapel } = formData;
    if (!username || !nama_lengkap) return Swal.fire('Oops', 'Data wajib diisi', 'warning');

    try {
      Swal.fire({ title: 'Memproses...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

      const payload = {
        username: username.toLowerCase().replace(/\s/g, ''),
        password,
        nama_lengkap: nama_lengkap.toUpperCase(),
        role,
        is_guru_mapel: Boolean(is_guru_mapel),
        kelas_id: (role === 'walas' || role === 'walikelas') ? parseInt(kelas_id) : null,
        kelas_diampu: (role === 'walas' || role === 'walikelas') ? kelas.find(k => k.id == kelas_id)?.nama_kelas : null
      };

      if (isEditing) {
        await supabase.from('walikelas').update(payload).eq('id', currentId);
        Swal.fire('Berhasil', 'Data user diperbarui', 'success');
      } else {
        await supabase.from('walikelas').insert([payload]);
        Swal.fire('Berhasil', 'User baru ditambahkan', 'success');
      }

      handleCancel();
      fetchInitialData();
    } catch (err) {
      Swal.fire('Gagal', err.message, 'error');
    }
  };

  const handleEdit = (u) => {
    setIsEditing(true); setIsAdding(true); setCurrentId(u.id);
    setFormData({
      username: u.username || '',
      password: u.password || '',
      nama_lengkap: u.nama_lengkap || '',
      role: normalizeAllowedRole(u.role),
        kelas_id: u.kelas_id || '',
        is_guru_mapel: toBooleanFlag(u.is_guru_mapel),
      });
  };

  const handleCancel = () => {
    setIsAdding(false); setIsEditing(false); setCurrentId(null);
    setFormData({
      username: '',
      password: '',
      nama_lengkap: '',
      role: 'guru',
      kelas_id: '',
      is_guru_mapel: false,
    });
  };

  const handleDelete = async (id) => {
    const res = await Swal.fire({ title: 'Hapus User?', text: "Permanen loh!", icon: 'warning', showCancelButton: true });
    if (res.isConfirmed) {
      await supabase.from('walikelas').delete().eq('id', id);
      fetchInitialData();
    }
  };

  return (
    <PageContainer>
      <PageHeader>
        <div>
          <PageTitle className="text-3xl italic uppercase">Manajemen Akun</PageTitle>
          <PageSubtitle className="mt-2">Total {users.length} pengguna terdaftar</PageSubtitle>
        </div>
        <div className="flex gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
            {isImporting ? <Loader2 className="animate-spin" size={16} /> : <FileUp size={16} />}
            Import Excel
            <input type="file" className="hidden" accept=".xlsx" onChange={handleImportUser} />
          </label>
          <Button onClick={() => setIsAdding(true)} size="md" className="text-xs uppercase">
            <UserPlus size={16} /> Tambah Manual
          </Button>
        </div>
      </PageHeader>

      {isAdding && (
        <Card className="mb-10 rounded-3xl animate-in fade-in zoom-in duration-300">
          <CardContent className="p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="font-black uppercase text-sm italic">{isEditing ? 'Ubah Akun' : 'Akun Baru'}</h2>
            <button onClick={handleCancel} className="p-2 bg-red-50 text-red-500 rounded-full"><X size={18} /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Nama Lengkap</label>
              <InputField icon={User} type="text" className="px-4 py-3" value={formData.nama_lengkap} onChange={(e)=>setFormData({...formData, nama_lengkap: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Username</label>
              <InputField icon={Fingerprint} type="text" className="px-4 py-3" value={formData.username} onChange={(e)=>setFormData({...formData, username: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Password</label>
              <input type="password" title="pw" className="w-full bg-gray-50 rounded-2xl px-4 py-3 text-xs font-bold outline-none border border-transparent focus:border-blue-500" value={formData.password} onChange={(e)=>setFormData({...formData, password: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Role</label>
              <select
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black uppercase text-slate-700 outline-none focus:border-blue-500"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              >
                <option value="walikelas">Wali Kelas</option>
                <option value="guru">Guru</option>
                <option value="piket">Piket</option>
                <option value="admin">Admin</option>
                <option value="kaprog">Kaprog</option>
                <option value="kepsek">Kepsek</option>
                <option value="kesiswaan">Kesiswaan</option>
                <option value="kurikulum">Kurikulum</option>
              </select>
            </div>

            <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <label className="flex cursor-pointer items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wide text-slate-600">
                    Aktifkan Akses Guru Mapel
                  </p>
                  <p className="mt-1 text-[10px] font-semibold text-slate-400">
                    Jika aktif, akun ini bisa masuk workspace mapel sesuai logic V2.
                  </p>
                </div>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-blue-600"
                  checked={Boolean(formData.is_guru_mapel)}
                  onChange={(e) => setFormData({ ...formData, is_guru_mapel: e.target.checked })}
                />
              </label>
            </div>

            {(formData.role === 'walas' || formData.role === 'walikelas') && (
              <div className="md:col-span-2 space-y-2">
                <label className="text-[10px] font-black uppercase text-blue-600 ml-2 italic">Pilih Kelas Diampu</label>
                <select className="w-full bg-gray-900 text-white rounded-2xl px-4 py-4 text-xs font-black uppercase outline-none" value={formData.kelas_id} onChange={(e)=>setFormData({...formData, kelas_id: e.target.value})}>
                  <option value="">-- Klik untuk Pilih --</option>
                  {kelas.map(k => <option key={k.id} value={k.id}>{k.nama_kelas}</option>)}
                </select>
              </div>
            )}
          </div>
          <Button onClick={handleSave} size="lg" className="w-full mt-8 text-xs uppercase">
             <Save size={18} /> {isEditing ? 'Simpan Perubahan' : 'Buat Akun Sekarang'}
          </Button>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-3xl overflow-hidden">
        <table className="premium-table text-left">
          <thead>
            <tr className="border-b border-gray-100">
              <th>Pengguna</th>
              <th className="text-center">Jabatan</th>
              <th>Akses Kelas</th>
              <th className="text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr>
                <td colSpan="4" className="p-16 text-center">
                  <Loader2 className="animate-spin mx-auto text-blue-600 mb-3" />
                  <span className="micro-loading">Memuat data pengguna...</span>
                </td>
              </tr>
            ) : users.map((u) => (
              <tr key={u.id} className="hover:bg-blue-50/20 transition-all group">
                <td className="p-6">
                  <p className="font-black text-gray-800 text-xs uppercase">{u.nama_lengkap}</p>
                  <p className="text-[10px] text-gray-400 font-bold font-mono">{u.username}</p>
                </td>
                <td className="p-6 text-center">
                  <div className="inline-flex flex-col items-center gap-1">
                    <span className="bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-[8px] font-black uppercase italic">{u.role}</span>
                    {toBooleanFlag(u.is_guru_mapel) && (
                      <span className="rounded-full bg-indigo-100 px-3 py-1 text-[8px] font-black uppercase italic text-indigo-600">
                        Guru Mapel
                      </span>
                    )}
                  </div>
                </td>
                <td className="p-6 text-[10px] font-black text-gray-600 uppercase italic">
                  {u.master_kelas?.nama_kelas || u.kelas_diampu || '---'}
                </td>
                <td className="p-6 text-right space-x-1">
                    <button onClick={() => handleEdit(u)} className="p-2 text-gray-300 hover:text-blue-500 transition-all"><Edit3 size={18} /></button>
                    <button onClick={() => handleDelete(u.id)} className="p-2 text-gray-300 hover:text-red-500 transition-all"><Trash2 size={18} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </PageContainer>
  );
};

export default ManajemenUser;
