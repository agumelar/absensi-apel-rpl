// ============================================================
// DEMO DATA – Semua data di sini adalah fiktif untuk keperluan demo.
// Tidak ada koneksi ke database sungguhan.
// ============================================================

// ---------- helpers ----------
const pad = (n) => String(n).padStart(2, '0');

/** Hasilkan tanggal YYYY-MM-DD di balik hariIni sebanyak n hari. */
const pastDates = (n) => {
  const dates = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    // Lewati hari Minggu
    if (d.getDay() === 0) continue;
    dates.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
  }
  return dates;
};

const TODAY = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
})();

// ---- fixed random seed untuk data yang konsisten ----
let _seed = 42;
const seededRandom = () => {
  _seed = (_seed * 16807 + 0) % 2147483647;
  return (_seed - 1) / 2147483646;
};
const seededChoice = (arr) => arr[Math.floor(seededRandom() * arr.length)];

// ---------- master_jurusan ----------
export const masterJurusan = [
  { id: 'j1', nama_jurusan: 'Rekayasa Perangkat Lunak', kode_jurusan: 'RPL' },
  { id: 'j2', nama_jurusan: 'Teknik Komputer dan Jaringan', kode_jurusan: 'TKJ' },
  { id: 'j3', nama_jurusan: 'Multimedia', kode_jurusan: 'MM' },
];

// ---------- master_kelas ----------
export const masterKelas = [
  { id: 'k1', nama_kelas: 'X RPL 1',  jurusan_id: 'j1', tingkat: 'X',   jurusan: { id: 'j1', nama_jurusan: 'Rekayasa Perangkat Lunak' } },
  { id: 'k2', nama_kelas: 'X RPL 2',  jurusan_id: 'j1', tingkat: 'X',   jurusan: { id: 'j1', nama_jurusan: 'Rekayasa Perangkat Lunak' } },
  { id: 'k3', nama_kelas: 'XI RPL 1', jurusan_id: 'j1', tingkat: 'XI',  jurusan: { id: 'j1', nama_jurusan: 'Rekayasa Perangkat Lunak' } },
  { id: 'k4', nama_kelas: 'XI RPL 2', jurusan_id: 'j1', tingkat: 'XI',  jurusan: { id: 'j1', nama_jurusan: 'Rekayasa Perangkat Lunak' } },
  { id: 'k5', nama_kelas: 'XII RPL 1',jurusan_id: 'j1', tingkat: 'XII', jurusan: { id: 'j1', nama_jurusan: 'Rekayasa Perangkat Lunak' } },
  { id: 'k6', nama_kelas: 'X TKJ 1',  jurusan_id: 'j2', tingkat: 'X',   jurusan: { id: 'j2', nama_jurusan: 'Teknik Komputer dan Jaringan' } },
  { id: 'k7', nama_kelas: 'XI TKJ 1', jurusan_id: 'j2', tingkat: 'XI',  jurusan: { id: 'j2', nama_jurusan: 'Teknik Komputer dan Jaringan' } },
  { id: 'k8', nama_kelas: 'XI MM 1',  jurusan_id: 'j3', tingkat: 'XI',  jurusan: { id: 'j3', nama_jurusan: 'Multimedia' } },
];

// ---------- walikelas (user accounts) ----------
export const walikelas = [
  { id: 'u1',  walikelas_id: 'u1',  nama_lengkap: 'Ahmad Fauzi, S.Kom',      username: 'admin',  password: 'demo', role: 'admin',     kelas_id: null, jurusan_id: null, is_guru_mapel: false },
  { id: 'u2',  walikelas_id: 'u2',  nama_lengkap: 'Siti Nurhaliza, S.Pd',    username: 'walas1', password: 'demo', role: 'walas',     kelas_id: 'k3', jurusan_id: 'j1', is_guru_mapel: false },
  { id: 'u3',  walikelas_id: 'u3',  nama_lengkap: 'Budi Santoso, S.Pd',      username: 'walas2', password: 'demo', role: 'walas',     kelas_id: 'k4', jurusan_id: 'j1', is_guru_mapel: false },
  { id: 'u4',  walikelas_id: 'u4',  nama_lengkap: 'Dewi Rahayu, S.Pd',       username: 'walas3', password: 'demo', role: 'walas',     kelas_id: 'k5', jurusan_id: 'j1', is_guru_mapel: false },
  { id: 'u5',  walikelas_id: 'u5',  nama_lengkap: 'Eko Prasetyo, S.Kom',     username: 'piket',  password: 'demo', role: 'piket',     kelas_id: null, jurusan_id: null, is_guru_mapel: false },
  { id: 'u6',  walikelas_id: 'u6',  nama_lengkap: 'Drs. H. Supriadi, M.Pd', username: 'kepsek', password: 'demo', role: 'kepsek',    kelas_id: null, jurusan_id: null, is_guru_mapel: false },
  { id: 'u7',  walikelas_id: 'u7',  nama_lengkap: 'Ir. Wahyu Kusuma',        username: 'kaprog', password: 'demo', role: 'kaprog',    kelas_id: null, jurusan_id: 'j1', is_guru_mapel: false },
  { id: 'u8',  walikelas_id: 'u8',  nama_lengkap: 'Lina Marlina, S.Pd',      username: 'kesiswaan', password: 'demo', role: 'kesiswaan', kelas_id: null, jurusan_id: null, is_guru_mapel: false },
  { id: 'u9',  walikelas_id: 'u9',  nama_lengkap: 'Rudi Hermawan, S.T',      username: 'guru1',  password: 'demo', role: 'guru',      kelas_id: null, jurusan_id: 'j1', is_guru_mapel: true },
  { id: 'u10', walikelas_id: 'u10', nama_lengkap: 'Yanti Suryani, S.Pd',     username: 'kurikulum', password: 'demo', role: 'kurikulum', kelas_id: null, jurusan_id: null, is_guru_mapel: false },
  { id: 'u11', walikelas_id: 'u11', nama_lengkap: 'Hendra Gunawan, S.Kom',   username: 'walas4', password: 'demo', role: 'walas',     kelas_id: 'k1', jurusan_id: 'j1', is_guru_mapel: false },
  { id: 'u12', walikelas_id: 'u12', nama_lengkap: 'Fitriani, S.Pd',          username: 'walas5', password: 'demo', role: 'walas',     kelas_id: 'k2', jurusan_id: 'j1', is_guru_mapel: false },
];

// ---------- siswa (students) ----------
const namaSiswa = [
  'Adi Nugraha','Bagas Pratama','Candra Dewi','Dinda Rahma','Eka Putra',
  'Fahri Maulana','Gita Permata','Hendra Wijaya','Indah Sari','Joko Susilo',
  'Kartika Wulandari','Lukman Hakim','Maya Putri','Nana Sudjana','Oki Firmansyah',
  'Putri Anggraeni','Qori Nurfadillah','Rizky Aditya','Sari Dewi','Taufik Hidayat',
  'Ulfa Rahmawati','Vino Syahputra','Wahyu Setiawan','Xena Olivia','Yogi Pratama',
  'Zahra Islamia','Arief Budiman','Bella Safitri','Citra Nisa','Deni Kurniawan',
  'Ester Magdalena','Farhan Maulidi','Gracia Simanjuntak','Hamid Nasution','Ika Lestari',
];

export const siswa = masterKelas.flatMap((kelas, ki) =>
  namaSiswa.slice(0, 25).map((nama, i) => {
    const id = `s_${kelas.id}_${i + 1}`;
    return {
      id,
      nama_siswa: nama,
      kelas_id: kelas.id,
      status_siswa: 'Aktif',
      nisn: `${20240000 + ki * 100 + i + 1}`,
      master_kelas: kelas,
    };
  })
);

// ---------- absensi (attendance) ----------
const STATUS_WEIGHTS = [
  ['Hadir', 75],
  ['Kesiangan', 8],
  ['Sakit', 7],
  ['Izin', 5],
  ['Alpha', 5],
];

const weightedStatus = (() => {
  const pool = [];
  STATUS_WEIGHTS.forEach(([s, w]) => {
    for (let i = 0; i < w; i++) pool.push(s);
  });
  return pool;
})();

const DATES = pastDates(60);

const randomJamHadir = (status) => {
  if (status === 'Hadir') return `06:${pad(Math.floor(seededRandom() * 50) + 1)}`;
  if (status === 'Kesiangan') return `07:${pad(Math.floor(seededRandom() * 30) + 16)}`;
  return null;
};

export const absensi = (() => {
  _seed = 42; // reset seed untuk konsistensi
  const records = [];
  let idCounter = 1;
  DATES.forEach((tanggal) => {
    siswa.forEach((s) => {
      const status = seededChoice(weightedStatus);
      if (status === 'Hadir' || status === 'Kesiangan' || seededRandom() > 0.3) {
        records.push({
          id: `abs_${idCounter++}`,
          siswa_id: s.id,
          tanggal,
          status,
          jam_hadir: randomJamHadir(status),
          bukti_url: null,
          siswa: {
            id: s.id,
            nama_siswa: s.nama_siswa,
            kelas_id: s.kelas_id,
            master_kelas: s.master_kelas,
          },
        });
      }
    });
  });
  return records;
})();

// ---------- master_mapel ----------
export const masterMapel = [
  { id: 'm1', nama_mapel: 'Pemrograman Web', kode_mapel: 'PWB', jurusan_id: 'j1' },
  { id: 'm2', nama_mapel: 'Basis Data',      kode_mapel: 'BDT', jurusan_id: 'j1' },
  { id: 'm3', nama_mapel: 'Jaringan Komputer',kode_mapel: 'JKO', jurusan_id: 'j2' },
  { id: 'm4', nama_mapel: 'Desain Grafis',   kode_mapel: 'DGR', jurusan_id: 'j3' },
  { id: 'm5', nama_mapel: 'Matematika',      kode_mapel: 'MTK', jurusan_id: null },
  { id: 'm6', nama_mapel: 'Bahasa Indonesia',kode_mapel: 'BIN', jurusan_id: null },
];

// ---------- schedule (mapel jadwal) ----------
export const schedule = [
  { id: 'sch1', guru_id: 'u9', kelas_id: 'k3', mapel_id: 'm1', hari: 'Senin',   jam_mulai: '07:00', jam_selesai: '08:30', walikelas: walikelas.find(u => u.id === 'u9'), master_kelas: masterKelas.find(k => k.id === 'k3'), master_mapel: masterMapel[0] },
  { id: 'sch2', guru_id: 'u9', kelas_id: 'k4', mapel_id: 'm2', hari: 'Selasa',  jam_mulai: '07:00', jam_selesai: '08:30', walikelas: walikelas.find(u => u.id === 'u9'), master_kelas: masterKelas.find(k => k.id === 'k4'), master_mapel: masterMapel[1] },
  { id: 'sch3', guru_id: 'u9', kelas_id: 'k5', mapel_id: 'm1', hari: 'Rabu',    jam_mulai: '09:00', jam_selesai: '10:30', walikelas: walikelas.find(u => u.id === 'u9'), master_kelas: masterKelas.find(k => k.id === 'k5'), master_mapel: masterMapel[0] },
];

// ---------- session (mapel sesi) ----------
export const session = (() => {
  _seed = 123;
  const sessions = [];
  let ctr = 1;
  schedule.forEach((sch) => {
    DATES.slice(0, 30).forEach((tgl) => {
      if (seededRandom() > 0.1) {
        sessions.push({
          id: `ses_${ctr++}`,
          schedule_id: sch.id,
          guru_id: sch.guru_id,
          tanggal: tgl,
          waktu_check_in: `${tgl}T07:${pad(Math.floor(seededRandom() * 15))}:00+07:00`,
          waktu_check_out: seededRandom() > 0.1 ? `${tgl}T08:${pad(Math.floor(seededRandom() * 30) + 30)}:00+07:00` : null,
          status: 'Hadir',
          agenda: 'Belajar materi bab ' + ctr,
          schedule: sch,
          walikelas: sch.walikelas,
        });
      }
    });
  });
  return sessions;
})();

// ---------- student_attendance_mapel ----------
export const studentAttendanceMapel = (() => {
  _seed = 456;
  const records = [];
  let ctr = 1;
  session.forEach((ses) => {
    const kelasId = ses.schedule?.kelas_id;
    const siswaKelas = siswa.filter((s) => s.kelas_id === kelasId);
    siswaKelas.forEach((s) => {
      const status = seededChoice(['Hadir', 'Hadir', 'Hadir', 'Sakit', 'Alpha']);
      records.push({
        id: `sam_${ctr++}`,
        session_id: ses.id,
        siswa_id: s.id,
        status,
        siswa: s,
        session: ses,
      });
    });
  });
  return records;
})();

// ---------- class_agenda ----------
export const classAgenda = session.map((ses, i) => ({
  id: `ag_${i + 1}`,
  session_id: ses.id,
  guru_id: ses.guru_id,
  tanggal: ses.tanggal,
  materi: 'Materi Pertemuan ke-' + (i + 1),
  keterangan: '',
}));

// ---------- log_piket ----------
export const logPiket = (() => {
  _seed = 789;
  return DATES.slice(0, 20).flatMap((tgl, i) =>
    ['Terlambat', 'Tidak Hadir'].flatMap((jenis) =>
      siswa
        .filter(() => seededRandom() > 0.85)
        .map((s, j) => ({
          id: `lp_${i * 100 + j}`,
          tanggal: tgl,
          siswa_id: s.id,
          jenis_kejadian: jenis,
          keterangan: jenis === 'Terlambat' ? 'Terlambat 15 menit' : 'Tidak hadir tanpa keterangan',
          petugas_piket: 'Eko Prasetyo',
          siswa: s,
        }))
    )
  );
})();

// ---------- mapel_audit_log ----------
export const mapelAuditLog = session.slice(0, 40).flatMap((ses, i) => [
  {
    id: `mal_${i * 3 + 1}`,
    session_id: ses.id,
    guru_id: ses.guru_id,
    action: 'session_check_in',
    tanggal: ses.tanggal,
    created_at: ses.waktu_check_in,
    metadata: {},
    walikelas: ses.walikelas,
  },
  ...(ses.waktu_check_out
    ? [{
        id: `mal_${i * 3 + 2}`,
        session_id: ses.id,
        guru_id: ses.guru_id,
        action: 'session_check_out',
        tanggal: ses.tanggal,
        created_at: ses.waktu_check_out,
        metadata: {},
        walikelas: ses.walikelas,
      }]
    : []),
]);

// ---------- gabungan semua tabel ----------
export const DEMO_DB = {
  master_jurusan: masterJurusan,
  master_kelas: masterKelas,
  walikelas,
  siswa,
  absensi,
  master_mapel: masterMapel,
  schedule,
  session,
  student_attendance_mapel: studentAttendanceMapel,
  class_agenda: classAgenda,
  log_piket: logPiket,
  mapel_audit_log: mapelAuditLog,
};

export { TODAY };
