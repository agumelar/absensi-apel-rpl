import React from 'react';

const ScheduleTable = ({ schedules, onEdit, onDelete, deletingId }) => {
  if (!schedules.length) {
    return (
      <div className="bg-white border border-gray-100 rounded-3xl p-6 text-sm text-gray-500">
        Belum ada jadwal. Tambahkan jadwal pertama kamu dari form di atas.
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-100 rounded-3xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px]">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-3">Hari</th>
              <th className="text-left px-4 py-3">Jam</th>
              <th className="text-left px-4 py-3">Kelas</th>
              <th className="text-left px-4 py-3">Mapel</th>
              <th className="text-right px-4 py-3">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {schedules.map((item) => (
              <tr key={item.id} className="border-t border-gray-100 text-sm">
                <td className="px-4 py-3 font-semibold">{item.hari}</td>
                <td className="px-4 py-3 font-semibold">
                  {String(item.jam_mulai).slice(0, 5)} - {String(item.jam_selesai).slice(0, 5)}
                </td>
                <td className="px-4 py-3">{item.master_kelas?.nama_kelas ?? '-'}</td>
                <td className="px-4 py-3">{item.master_mapel?.nama_mapel ?? '-'}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => onEdit(item)}
                      className="px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 font-bold text-xs uppercase"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDelete(item.id)}
                      disabled={deletingId === item.id}
                      className="px-3 py-1.5 rounded-lg bg-red-100 text-red-700 font-bold text-xs uppercase"
                    >
                      {deletingId === item.id ? 'Menghapus...' : 'Hapus'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ScheduleTable;
