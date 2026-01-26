import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';
import { 
  FileUp, Loader2, Search, Trash2, Download, 
  UserPlus, X, Save, Edit3, Filter, Moon, Sun, ArrowUpCircle, GraduationCap 
} from 'lucide-react';

const ManajemenSiswa = () => {
  const [listSiswa, setListSiswa] = useState([]);
  const [listKelas, setListKelas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedKelas, setSelectedKelas] = useState('');
  
  // Theme State
  const [darkMode, setDarkMode] = useState(localStorage.getItem('theme') === 'dark');

  // Form State
  const [isAddingManual, setIsAddingManual] = useState(false);
  const [formData, setFormData] = useState({ id: null, nis: '', nama_siswa: '', kelas_id: '', status_siswa: 'Aktif' });

  useEffect(() => {
    fetchData();
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: kls } = await supabase.from('master_kelas').select('*').order('nama_kelas');
      const { data: ssw } = await supabase
        .from('siswa')
        .select('*, master_kelas(nama_kelas)')
        .eq('status_siswa', 'Aktif')
        .order('kelas_id', { ascending: true })
        .order('nama_siswa', { ascending: true });
      
      setListKelas(kls || []);
      setListSiswa(ssw || []);
    } finally {
      setLoading(false);
    }
  };

  // FUNGSI SIMPAN MANUAL (TAMBAH & EDIT)
  const handleSaveManual = async () => {
    if (!formData.nama_siswa || !formData.kelas_id) {
      return Swal.fire('Oops', 'Nama dan Kelas wajib diisi!', 'warning');
    }
    
    try {
      Swal.fire({ title: 'Menyimpan...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      
      const payload = { 
        nis: formData.nis,
        nama_siswa: formData.nama_siswa.toUpperCase(),
        kelas_id: parseInt(formData.kelas_id),
        status_siswa: formData.status_siswa 
      };

      let error;
      if (formData.id) {
        // JIKA ADA ID = UPDATE (EDIT)
        const { error: err } = await supabase.from('siswa').update(payload).eq('id', formData.id);
        error = err;
      } else {
        // JIKA TIDAK ADA ID = INSERT (BARU)
        const { error: err } = await supabase.from('siswa').insert([payload]);
        error = err;
      }

      if (error) throw error;

      Swal.fire('Berhasil!', 'Data siswa telah diperbarui.', 'success');
      setIsAddingManual(false);
      setFormData({ id: null, nis: '', nama_siswa: '', kelas_id: '', status_siswa: 'Aktif' });
      fetchData();
    } catch (err) {
      Swal.fire('Gagal!', err.message, 'error');
    }
  };

  const deleteSiswa = async (id) => {
    const res = await Swal.fire({
      title: 'Hapus Siswa?',
      text: "Data absensi terkait mungkin akan ikut bermasalah.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: 'Ya, Hapus!'
    });
    if (res.isConfirmed) {
      await supabase.from('siswa').delete().eq('id', id);
      fetchData();
      Swal.fire('Terhapus', 'Siswa berhasil dihapus', 'success');
    }
  };

  // FUNGSI IMPORT EXCEL
  const handleImportSiswa = async (e) => {
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
        let tempMap = new Map();
        dataExcel.forEach((row) => {
          const klsMatch = listKelas.find(k => k.nama_kelas.trim().toUpperCase() === row.kelas?.toString().trim().toUpperCase());
          if (klsMatch && row.nis) {
            tempMap.set(row.nis.toString().trim(), {
              nis: row.nis.toString().trim(),
              nama_siswa: row.nama_siswa?.toString().trim().toUpperCase(),
              kelas_id: klsMatch.id,
              status_siswa: 'Aktif'
            });
          }
        });
        const finalData = Array.from(tempMap.values());
        const { error } = await supabase.from('siswa').upsert(finalData, { onConflict: 'nis' });
        if (error) throw error;
        Swal.fire('Sukses', `${finalData.length} data diproses`, 'success');
        fetchData();
      } catch (err) { Swal.fire('Error', err.message, 'error'); }
      finally { setIsImporting(false); e.target.value = null; }
    };
    reader.readAsBinaryString(file);
  };

  // AKSI MASSAL (NAIK KELAS / LULUS)
  const handleBulkAction = async () => {
    if (!selectedKelas) return;
    const { value: action } = await Swal.fire({
      title: 'Aksi Massal Kelas',
      input: 'select',
      inputOptions: { 'promote': 'Naik Kelas', 'graduate': 'Luluskan (Alumni)' },
      showCancelButton: true
    });

    if (action === 'graduate') {
      await supabase.from('siswa').update({ status_siswa: 'Alumni' }).eq('kelas_id', selectedKelas);
      Swal.fire('Berhasil', 'Siswa dipindah ke Alumni', 'success');
      fetchData();
    } else if (action === 'promote') {
      const { value: newKls } = await Swal.fire({
        title: 'Pilih Kelas Tujuan',
        input: 'select',
        inputOptions: Object.fromEntries(listKelas.map(k => [k.id, k.nama_kelas])),
        showCancelButton: true
      });
      if (newKls) {
        await supabase.from('siswa').update({ kelas_id: newKls }).eq('kelas_id', selectedKelas);
        Swal.fire('Berhasil', 'Kenaikan kelas sukses', 'success');
        fetchData();
      }
    }
  };

  const filteredSiswa = listSiswa.filter(s => {
    const matchesSearch = s.nama_siswa.toLowerCase().includes(searchTerm.toLowerCase()) || s.nis?.toString().includes(searchTerm);
    const matchesKelas = selectedKelas === '' || s.kelas_id === parseInt(selectedKelas);
    return matchesSearch && matchesKelas;
  });

  return (
    <div className={`min-h-screen transition-colors duration-300 ${darkMode ? 'bg-slate-900 text-white' : 'bg-gray-50 text-slate-800'} p-4 md:p-8 font-sans`}>
      
      <header className="max-w-6xl mx-auto mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-black italic uppercase tracking-tighter">Database Siswa</h1>
            <button onClick={() => setDarkMode(!darkMode)} className={`p-2 rounded-xl transition-all ${darkMode ? 'bg-yellow-400 text-slate-900' : 'bg-slate-800 text-white'}`}>
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
          <p className="text-blue-500 font-bold text-[10px] tracking-[0.3em] uppercase mt-2 italic">Data Management System</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {selectedKelas && (
            <button onClick={handleBulkAction} className="bg-orange-500 text-white px-5 py-3 rounded-2xl flex items-center gap-2 font-black text-[10px] uppercase shadow-lg shadow-orange-200">
              <ArrowUpCircle size={16} /> Aksi Massal
            </button>
          )}
          <button onClick={() => { setFormData({id:null, nis:'', nama_siswa:'', kelas_id:'', status_siswa:'Aktif'}); setIsAddingManual(true); }} className={`px-5 py-3 rounded-2xl flex items-center gap-2 font-black text-[10px] uppercase shadow-lg ${darkMode ? 'bg-slate-700' : 'bg-slate-900 text-white'}`}>
            <UserPlus size={16} /> Manual
          </button>
          <label className="bg-blue-600 text-white px-5 py-3 rounded-2xl flex items-center gap-2 font-black text-[10px] uppercase shadow-lg shadow-blue-200 cursor-pointer">
            {isImporting ? <Loader2 className="animate-spin" size={16} /> : <FileUp size={16} />}
            Excel
            <input type="file" className="hidden" accept=".xlsx,.xls,.csv" onChange={handleImportSiswa} />
          </label>
        </div>
      </header>

      {/* FORM MODAL */}
      {isAddingManual && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'} w-full max-w-md rounded-[40px] p-8 shadow-2xl animate-in zoom-in duration-300 border`}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-black italic uppercase tracking-tight">{formData.id ? 'Edit Siswa' : 'Tambah Siswa'}</h2>
              <button onClick={() => setIsAddingManual(false)} className="p-2 bg-red-50 text-red-500 rounded-full"><X size={20} /></button>
            </div>
            <div className="space-y-4 text-left">
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 ml-2">NIS</label>
                <input type="text" className={`${darkMode ? 'bg-slate-700' : 'bg-gray-100'} w-full p-4 rounded-2xl mt-1 outline-none font-bold text-xs`} value={formData.nis} onChange={e => setFormData({...formData, nis: e.target.value})} placeholder="Nomor Induk Siswa" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Nama Lengkap</label>
                <input type="text" className={`${darkMode ? 'bg-slate-700' : 'bg-gray-100'} w-full p-4 rounded-2xl mt-1 outline-none font-bold text-xs uppercase`} value={formData.nama_siswa} onChange={e => setFormData({...formData, nama_siswa: e.target.value})} placeholder="NAMA LENGKAP" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Kelas</label>
                <select className={`${darkMode ? 'bg-slate-700' : 'bg-blue-50 text-blue-600'} w-full p-4 rounded-2xl mt-1 outline-none font-black text-xs uppercase cursor-pointer`} value={formData.kelas_id} onChange={e => setFormData({...formData, kelas_id: e.target.value})}>
                  <option value="">Pilih Kelas</option>
                  {listKelas.map(k => <option key={k.id} value={k.id}>{k.nama_kelas}</option>)}
                </select>
              </div>
              <button onClick={handleSaveManual} className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-100 mt-4 flex items-center justify-center gap-2">
                <Save size={18} /> Simpan Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FILTER SEARCH & DROP */}
      <div className="max-w-6xl mx-auto mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`md:col-span-2 p-2 rounded-[25px] shadow-sm border flex items-center px-6 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`}>
          <Search size={20} className="text-gray-400" />
          <input className="w-full p-4 bg-transparent outline-none font-bold text-xs uppercase" placeholder="Cari Nama/NIS..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <div className={`p-2 rounded-[25px] shadow-sm border flex items-center px-4 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`}>
          <Filter size={18} className="text-blue-500 mr-2" />
          <select className="w-full p-3 bg-transparent outline-none font-black text-[10px] uppercase cursor-pointer" value={selectedKelas} onChange={e => setSelectedKelas(e.target.value)}>
            <option value="">Semua Kelas</option>
            {listKelas.map(k => <option key={k.id} value={k.id}>{k.nama_kelas}</option>)}
          </select>
        </div>
      </div>

      {/* TABLE */}
      <div className={`max-w-6xl mx-auto rounded-[40px] shadow-sm border overflow-hidden ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className={`${darkMode ? 'bg-slate-700/50' : 'bg-gray-50/50'} text-[10px] font-black text-gray-400 uppercase tracking-widest`}>
              <tr>
                <th className="p-6">NIS</th>
                <th className="p-6">Nama Siswa</th>
                <th className="p-6">Kelas</th>
                <th className="p-6 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${darkMode ? 'divide-slate-700' : 'divide-gray-50'}`}>
              {filteredSiswa.map(s => (
                <tr key={s.id} className="hover:bg-blue-500/5 transition-all">
                  <td className="p-6 text-xs font-black text-blue-500">{s.nis || '---'}</td>
                  <td className="p-6 text-xs font-bold uppercase">{s.nama_siswa}</td>
                  <td className="p-6">
                    <span className="bg-blue-500/10 text-blue-500 px-4 py-1.5 rounded-xl text-[9px] font-black uppercase italic border border-blue-500/20">
                      {s.master_kelas?.nama_kelas}
                    </span>
                  </td>
                  <td className="p-6 text-right space-x-1">
                    <button onClick={() => { setFormData({...s}); setIsAddingManual(true); }} className="p-2.5 text-gray-400 hover:text-blue-500 transition-all"><Edit3 size={16} /></button>
                    <button onClick={() => deleteSiswa(s.id)} className="p-2.5 text-gray-400 hover:text-red-500 transition-all"><Trash2 size={16} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="max-w-6xl mx-auto mt-6 text-[10px] font-black uppercase tracking-widest text-gray-400 italic">
        Total: {filteredSiswa.length} Siswa Aktif
      </div>
    </div>
  );
};

export default ManajemenSiswa;