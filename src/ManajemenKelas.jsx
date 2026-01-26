import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { 
  Plus, Trash2, Loader2, X, Save, School, Filter 
} from 'lucide-react';
import Swal from 'sweetalert2';

const ManajemenKelas = () => {
  const [kelas, setKelas] = useState([]);
  const [jurusan, setJurusan] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [filterJurusan, setFilterJurusan] = useState('all');
  
  const [formData, setFormData] = useState({ nama_kelas: '', jurusan_id: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data: dataJurusan } = await supabase.from('master_jurusan').select('*').order('nama_jurusan');
      const { data: dataKelas } = await supabase.from('master_kelas').select('*, master_jurusan(nama_jurusan, kode_jurusan)').order('nama_kelas');
      
      setJurusan(dataJurusan || []);
      setKelas(dataKelas || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.nama_kelas || !formData.jurusan_id) {
      return Swal.fire('Oops!', 'Nama Kelas dan Jurusan wajib diisi', 'warning');
    }

    try {
      const { error } = await supabase.from('master_kelas').insert([formData]);
      if (error) throw error;
      
      Swal.fire('Berhasil', 'Kelas baru ditambahkan', 'success');
      setFormData({ nama_kelas: '', jurusan_id: '' });
      setIsAdding(false);
      fetchData();
    } catch (err) {
      Swal.fire('Gagal', err.message, 'error');
    }
  };

  const handleDelete = async (id) => {
    const result = await Swal.fire({
      title: 'Hapus Kelas?',
      text: "Data siswa di kelas ini mungkin akan terdampak!",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
    });

    if (result.isConfirmed) {
      const { error } = await supabase.from('master_kelas').delete().eq('id', id);
      if (error) Swal.fire('Gagal', 'Kelas masih digunakan oleh data lain', 'error');
      else fetchData();
    }
  };

  const filteredKelas = filterJurusan === 'all' 
    ? kelas 
    : kelas.filter(k => k.jurusan_id.toString() === filterJurusan);

  return (
    <div className="max-w-5xl mx-auto p-4 font-sans">
      <header className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-black italic uppercase text-gray-800 tracking-tighter leading-none">Manajemen Kelas</h1>
          <p className="text-blue-600 font-bold text-[10px] tracking-[0.3em] mt-2 uppercase">Total {kelas.length} Kelas Terdaftar</p>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="bg-blue-600 text-white px-6 py-3 rounded-2xl flex items-center gap-2 font-black text-[10px] uppercase shadow-lg shadow-blue-200 active:scale-95 transition-all"
        >
          {isAdding ? <X size={16} /> : <Plus size={16} />} {isAdding ? 'Batal' : 'Tambah Kelas'}
        </button>
      </header>

      {/* FILTER JURUSAN */}
      <div className="mb-6 flex items-center gap-3 bg-white p-4 rounded-[25px] border border-gray-100 shadow-sm">
        <Filter size={16} className="text-gray-400" />
        <select 
          className="text-xs font-black uppercase outline-none bg-transparent w-full"
          value={filterJurusan}
          onChange={(e) => setFilterJurusan(e.target.value)}
        >
          <option value="all">Semua Jurusan</option>
          {jurusan.map(j => <option key={j.id} value={j.id}>{j.nama_jurusan}</option>)}
        </select>
      </div>

      {isAdding && (
        <div className="bg-white p-8 rounded-[40px] border border-blue-100 shadow-xl mb-10 animate-in fade-in zoom-in duration-300">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Nama Kelas</label>
              <input 
                type="text" 
                className="w-full bg-gray-50 rounded-2xl px-4 py-4 text-xs font-black uppercase outline-none border-2 border-transparent focus:border-blue-500" 
                placeholder="Contoh: 10 RPL 2" 
                value={formData.nama_kelas} 
                onChange={(e) => setFormData({...formData, nama_kelas: e.target.value})} 
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-gray-400 ml-2">Program Keahlian (Jurusan)</label>
              <select 
                className="w-full bg-gray-50 rounded-2xl px-4 py-4 text-xs font-black uppercase outline-none border-2 border-transparent focus:border-blue-500 text-blue-600"
                value={formData.jurusan_id}
                onChange={(e) => setFormData({...formData, jurusan_id: e.target.value})}
              >
                <option value="">-- Pilih Jurusan --</option>
                {jurusan.map(j => <option key={j.id} value={j.id}>{j.nama_jurusan}</option>)}
              </select>
            </div>
          </div>
          <button onClick={handleSave} className="w-full mt-8 bg-gray-900 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2">
            <Save size={18} /> Simpan Data Kelas
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {loading ? (
          <div className="col-span-full py-20 text-center"><Loader2 className="animate-spin mx-auto text-blue-600" /></div>
        ) : filteredKelas.map((k) => (
          <div key={k.id} className="bg-white p-6 rounded-[35px] border border-gray-100 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
            <School size={40} className="absolute -right-2 -bottom-2 text-gray-50 group-hover:text-blue-50 transition-colors" />
            <div className="relative z-10">
              <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[8px] font-black uppercase italic mb-2 inline-block">
                {k.master_jurusan?.kode_jurusan}
              </span>
              <h3 className="text-xl font-black text-gray-800 italic uppercase leading-none">{k.nama_kelas}</h3>
              <button 
                onClick={() => handleDelete(k.id)}
                className="mt-4 p-2 text-red-300 hover:text-red-500 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ManajemenKelas;