import React, { useState, useEffect } from 'react';
import { supabase } from '../../../supabaseClient';
import * as XLSX from 'xlsx'; // Pastikan sudah install: npm install xlsx
import { 
  UserPlus, Trash2, Edit3, User, Loader2, X, Save, Fingerprint, FileUp, Download
} from 'lucide-react';
import Swal from 'sweetalert2';

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
    role: 'walikelas',
    kelas_id: ''
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

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const dataExcel = XLSX.utils.sheet_to_json(ws);

        let finalData = [];
        let errorLog = [];

        dataExcel.forEach((row, index) => {
          const roleRaw = row.role?.toLowerCase().trim() || 'walikelas';
          const namaKelasRaw = row.kelas?.toString().trim().toUpperCase();
          
          // Cari Match Kelas
          const klsMatch = kelas.find(k => k.nama_kelas.trim().toUpperCase() === namaKelasRaw);

          // VALIDASI: Kalau Walikelas tapi kelasnya gak ketemu di database
          if ((roleRaw === 'walikelas' || roleRaw === 'walas') && !klsMatch) {
            errorLog.push(`Baris ${index + 2}: Kelas "${namaKelasRaw}" tidak ditemukan di Master Kelas`);
          } else {
            finalData.push({
              username: row.username?.toString().toLowerCase().trim(),
              password: row.password?.toString() || 'Jingga123',
              nama_lengkap: row.nama_lengkap?.toUpperCase().trim(),
              role: roleRaw,
              kelas_id: klsMatch ? klsMatch.id : null,
              kelas_diampu: klsMatch ? klsMatch.nama_kelas : null, // Ini sekarang aman karena SQL di atas
            });
          }
        });

        // Kalau ada error typo nama kelas, stop & kasih tau user
        if (errorLog.length > 0) {
          setIsImporting(false);
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
    reader.readAsBinaryString(file);
  };

  const handleSave = async () => {
    const { username, password, nama_lengkap, role, kelas_id } = formData;
    if (!username || !nama_lengkap) return Swal.fire('Oops', 'Data wajib diisi', 'warning');

    try {
      Swal.fire({ title: 'Memproses...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

      const payload = {
        username: username.toLowerCase().replace(/\s/g, ''),
        password,
        nama_lengkap: nama_lengkap.toUpperCase(),
        role,
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
      role: u.role || 'walikelas',
      kelas_id: u.kelas_id || ''
    });
  };

  const handleCancel = () => {
    setIsAdding(false); setIsEditing(false); setCurrentId(null);
    setFormData({ username: '', password: '', nama_lengkap: '', role: 'walikelas', kelas_id: '' });
  };

  const handleDelete = async (id) => {
    const res = await Swal.fire({ title: 'Hapus User?', text: "Permanen loh!", icon: 'warning', showCancelButton: true });
    if (res.isConfirmed) {
      await supabase.from('walikelas').delete().eq('id', id);
      fetchInitialData();
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 font-sans text-gray-800">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
        <div>
          <h1 className="text-3xl font-black italic uppercase text-gray-800 tracking-tighter leading-none">Manajemen Akun</h1>
          <p className="text-blue-600 font-bold text-[10px] tracking-[0.3em] mt-2 uppercase">Total {users.length} Pengguna Terdaftar</p>
        </div>
        <div className="flex gap-2">
          <label className="bg-gray-100 text-gray-600 px-5 py-3 rounded-2xl flex items-center gap-2 font-black text-[10px] uppercase cursor-pointer hover:bg-gray-200 transition-all">
            {isImporting ? <Loader2 className="animate-spin" size={16} /> : <FileUp size={16} />}
            Import Excel
            <input type="file" className="hidden" accept=".xlsx,.xls" onChange={handleImportUser} />
          </label>
          <button onClick={() => setIsAdding(true)} className="bg-blue-600 text-white px-6 py-3 rounded-2xl flex items-center gap-2 font-black text-[10px] uppercase shadow-lg shadow-blue-200">
            <UserPlus size={16} /> Tambah Manual
          </button>
        </div>
      </header>

      {isAdding && (
        <div className="bg-white p-8 rounded-[40px] border border-blue-100 shadow-xl mb-10 animate-in fade-in zoom-in duration-300">
          <div className="flex justify-between items-center mb-6">
            <h2 className="font-black uppercase text-sm italic">{isEditing ? 'Ubah Akun' : 'Akun Baru'}</h2>
            <button onClick={handleCancel} className="p-2 bg-red-50 text-red-500 rounded-full"><X size={18} /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Nama Lengkap</label>
              <div className="flex items-center gap-3 bg-gray-50 px-4 py-3 rounded-2xl">
                <User size={18} className="text-gray-400" />
                <input type="text" className="bg-transparent outline-none w-full font-bold text-xs uppercase" value={formData.nama_lengkap} onChange={(e)=>setFormData({...formData, nama_lengkap: e.target.value})} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Username</label>
              <div className="flex items-center gap-3 bg-gray-50 px-4 py-3 rounded-2xl">
                <Fingerprint size={18} className="text-gray-400" />
                <input type="text" className="bg-transparent outline-none w-full font-bold text-xs" value={formData.username} onChange={(e)=>setFormData({...formData, username: e.target.value})} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Password</label>
              <input type="password" title="pw" className="w-full bg-gray-50 rounded-2xl px-4 py-3 text-xs font-bold outline-none border border-transparent focus:border-blue-500" value={formData.password} onChange={(e)=>setFormData({...formData, password: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Role</label>
              <select className="w-full bg-blue-50 text-blue-600 rounded-2xl px-4 py-3 text-xs font-black uppercase outline-none" value={formData.role} onChange={(e)=>setFormData({...formData, role: e.target.value})}>
                <option value="walikelas">Wali Kelas</option>
                <option value="piket">Piket</option>
                <option value="admin">Admin</option>
                <option value="kaprog">Kaprog</option>
              </select>
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
          <button onClick={handleSave} className="w-full mt-8 bg-blue-600 text-white py-4 rounded-2xl font-black text-xs uppercase shadow-lg transition-all flex items-center justify-center gap-2">
             <Save size={18} /> {isEditing ? 'Simpan Perubahan' : 'Buat Akun Sekarang'}
          </button>
        </div>
      )}

      <div className="bg-white rounded-[40px] border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-black text-gray-400 uppercase tracking-widest">
              <th className="p-6">Pengguna</th>
              <th className="p-6 text-center">Jabatan</th>
              <th className="p-6">Akses Kelas</th>
              <th className="p-6 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {loading ? (
              <tr><td colSpan="4" className="p-20 text-center"><Loader2 className="animate-spin mx-auto text-blue-600" /></td></tr>
            ) : users.map((u) => (
              <tr key={u.id} className="hover:bg-blue-50/20 transition-all group">
                <td className="p-6">
                  <p className="font-black text-gray-800 text-xs uppercase">{u.nama_lengkap}</p>
                  <p className="text-[10px] text-gray-400 font-bold font-mono">{u.username}</p>
                </td>
                <td className="p-6 text-center">
                  <span className="bg-blue-100 text-blue-600 px-3 py-1 rounded-full text-[8px] font-black uppercase italic">{u.role}</span>
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
      </div>
    </div>
  );
};

export default ManajemenUser;
