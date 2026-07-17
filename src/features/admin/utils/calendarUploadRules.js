// Logika murni fitur Kalender Pendidikan Upload.
// Berkas ini WAJIB bebas dependensi Supabase & React agar dapat diuji
// secara deterministik dengan `node --test` (berkas *.test.mjs).

export const MAX_RANGE_SPAN = 400; // hari per Range_Row (Req 4.5)
export const BATCH_SIZE = 500; // baris per batch upsert (Req 7.3)
export const REQUIRED_COLUMNS = ['tanggal_mulai', 'tanggal_selesai'];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Format sebuah Date menjadi ISO_Date (YYYY-MM-DD) pada zona WIB (Asia/Jakarta).
// Memakai pola Intl `en-CA` seperti dateService agar konsisten dan tidak geser hari.
// Jika Intl/zona WIB tidak tersedia, jatuh ke zona sistem sebagai cadangan (Req 5.7).
const formatIsoWIB = (date) => {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    // Fallback zona sistem: rakit manual dari komponen lokal.
    const yyyy = String(date.getFullYear()).padStart(4, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
};

// Parsing tanggal fleksibel: menerima `YYYY-MM-DD` dan `DD/MM/YYYY`.
// Mengembalikan { iso, error }. Nilai kosong → { iso: null, error: null }.
export const parseFlexibleDate = (rawValue) => {
  const s = String(rawValue ?? '').trim();
  if (s === '') return { iso: null, error: null };

  let yyyy;
  let mm;
  let dd;

  const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const dmyMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (isoMatch) {
    [, yyyy, mm, dd] = isoMatch;
  } else if (dmyMatch) {
    [, dd, mm, yyyy] = dmyMatch;
  } else {
    return { iso: null, error: 'format tidak dikenal' };
  }

  const yearNum = Number(yyyy);
  const monthNum = Number(mm);
  const dayNum = Number(dd);

  // Normalisasi ke dua digit agar kandidat berformat konsisten.
  const candidate = `${String(yearNum).padStart(4, '0')}-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;

  // Rakit & validasi kalender pakai anchor tengah hari WIB agar aman zona waktu.
  const anchored = new Date(`${candidate}T12:00:00+07:00`);
  if (Number.isNaN(anchored.getTime())) {
    return { iso: null, error: 'tanggal tidak valid' };
  }

  // Bila tanggal tidak nyata (mis. 31/02/2026), hasil normalisasi WIB
  // tidak akan sama dengan kandidat aslinya.
  const wibIso = formatIsoWIB(anchored);
  if (wibIso !== candidate) {
    return { iso: null, error: 'tanggal tidak valid' };
  }

  return { iso: candidate, error: null };
};

// Enumerasi ISO_Date dari startIso hingga endIso secara inklusif.
// Iterasi per hari memakai anchor tengah hari WIB agar tidak geser hari.
export const enumerateDatesInclusiveWIB = (startIso, endIso) => {
  const start = String(startIso ?? '').trim().slice(0, 10);
  const end = String(endIso ?? '').trim().slice(0, 10);
  if (!start || !end) return [];

  const startAnchor = new Date(`${start}T12:00:00+07:00`);
  const endAnchor = new Date(`${end}T12:00:00+07:00`);
  if (Number.isNaN(startAnchor.getTime()) || Number.isNaN(endAnchor.getTime())) {
    return [];
  }
  if (endAnchor.getTime() < startAnchor.getTime()) return [];

  const dates = [];
  const cursor = new Date(startAnchor.getTime());
  while (cursor.getTime() <= endAnchor.getTime()) {
    dates.push(formatIsoWIB(cursor));
    cursor.setTime(cursor.getTime() + MS_PER_DAY);
  }
  return dates;
};

// True bila tanggal jatuh pada Sabtu/Minggu menurut kalender WIB.
// Selaras dengan schoolDayRules.isBusinessWeekdayWIBDate (ISO day 6/7 = weekend).
export const isWeekendWIBDate = (iso) => {
  const dateOnly = String(iso ?? '').trim().slice(0, 10);
  if (!dateOnly) return false;
  const parsed = new Date(`${dateOnly}T12:00:00+07:00`);
  if (Number.isNaN(parsed.getTime())) return false;
  const isoDay = ((parsed.getUTCDay() + 6) % 7) + 1;
  return isoDay >= 6;
};

// Hitung jumlah hari inklusif antara dua ISO_Date (mis. sama → 1).
// Mengembalikan null bila salah satu anchor tidak valid.
const inclusiveSpanDays = (startIso, endIso) => {
  const startAnchor = new Date(`${startIso}T12:00:00+07:00`);
  const endAnchor = new Date(`${endIso}T12:00:00+07:00`);
  if (Number.isNaN(startAnchor.getTime()) || Number.isNaN(endAnchor.getTime())) {
    return null;
  }
  const diff = endAnchor.getTime() - startAnchor.getTime();
  return Math.round(diff / MS_PER_DAY) + 1;
};

// Validasi baris hasil parsing berkas unggahan.
// Mengembalikan { rows, errors }. Kontrak "semua-atau-tidak": bila errors.length > 0,
// pemanggil TIDAK melanjutkan ke expand/preview/tulis (Req 4.7).
// Nomor baris pada pesan galat memakai konvensi UI (header = baris 1), jadi lineNo = index + 2.
export const validateRangeRows = (rawRows) => {
  const errors = [];
  const rows = [];

  const list = Array.isArray(rawRows) ? rawRows : [];

  // 1. Cek kolom wajib hilang (Req 4.1) berdasar kunci baris pertama non-kosong.
  const firstRow = list.find(
    (row) => row && typeof row === 'object' && Object.keys(row).length > 0,
  );
  if (firstRow) {
    const keys = Object.keys(firstRow);
    const missing = REQUIRED_COLUMNS.filter((col) => !keys.includes(col));
    if (missing.length > 0) {
      errors.push(`Kolom wajib hilang: ${missing.join(', ')}.`);
      return { rows: [], errors };
    }
  }

  // 2. Validasi tiap baris.
  list.forEach((raw, index) => {
    const lineNo = index + 2; // header = baris 1

    const rawStart = raw?.tanggal_mulai;
    const rawEnd = raw?.tanggal_selesai;

    const start = parseFlexibleDate(rawStart);
    const end = parseFlexibleDate(rawEnd);

    if (start.error || !start.iso) {
      errors.push(
        `Baris ${lineNo}: tanggal_mulai "${String(rawStart ?? '')}" tidak valid.`,
      );
      return;
    }
    if (end.error || !end.iso) {
      errors.push(
        `Baris ${lineNo}: tanggal_selesai "${String(rawEnd ?? '')}" tidak valid.`,
      );
      return;
    }
    if (end.iso < start.iso) {
      errors.push(
        `Baris ${lineNo}: tanggal_selesai lebih awal dari tanggal_mulai.`,
      );
      return;
    }

    const span = inclusiveSpanDays(start.iso, end.iso);
    if (span === null) {
      errors.push(
        `Baris ${lineNo}: rentang tanggal tidak dapat dihitung.`,
      );
      return;
    }
    if (span > MAX_RANGE_SPAN) {
      errors.push(
        `Baris ${lineNo}: rentang ${span} hari melebihi batas ${MAX_RANGE_SPAN} hari.`,
      );
      return;
    }

    // Keterangan kosong/whitespace → null (Req 4.6).
    const keteranganTrimmed = String(raw?.keterangan ?? '').trim();
    const keterangan = keteranganTrimmed === '' ? null : keteranganTrimmed;

    rows.push({
      tanggalMulai: start.iso,
      tanggalSelesai: end.iso,
      keterangan,
      lineNo,
    });
  });

  return { rows, errors };
};

// Expand tiap Range_Row valid menjadi Daily_Record harian.
// - Inklusif via enumerateDatesInclusiveWIB.
// - Lewati Weekend_Date (Req 5.4).
// - is_libur selalu true (Req 5.2, 9.1).
// - Dedup by tanggal dengan aturan "keterangan terakhir menang" (Req 5.5).
// - Keluaran terurut menaik by tanggal.
export const expandRangesToDailyRecords = (rows) => {
  const list = Array.isArray(rows) ? rows : [];
  const byDate = new Map(); // key: iso, value: keterangan (terakhir menang)
  let usedSystemTZFallback = false;

  // Deteksi ketersediaan perhitungan WIB via Intl (Req 5.7).
  try {
    Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' });
  } catch {
    usedSystemTZFallback = true;
  }

  list.forEach((row) => {
    const dates = enumerateDatesInclusiveWIB(row.tanggalMulai, row.tanggalSelesai);
    dates.forEach((iso) => {
      if (isWeekendWIBDate(iso)) return; // Req 5.4
      byDate.set(iso, row.keterangan ?? null); // overwrite = keterangan terakhir
    });
  });

  const records = [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([tanggal, keterangan]) => ({ tanggal, is_libur: true, keterangan }));

  return { records, usedSystemTZFallback };
};

// Bangun PreviewModel dari Daily_Record dan himpunan tanggal existing.
// status 'overwrite' bila tanggal ada di existingDatesSet, selain itu 'new' (Req 6.3).
export const buildPreviewModel = (dailyRecords, existingDatesSet) => {
  const records = Array.isArray(dailyRecords) ? dailyRecords : [];
  const existing =
    existingDatesSet instanceof Set ? existingDatesSet : new Set(existingDatesSet ?? []);

  const items = records.map((r) => ({
    tanggal: r.tanggal,
    keterangan: r.keterangan ?? null,
    status: existing.has(r.tanggal) ? 'overwrite' : 'new',
  }));

  const overwriteCount = items.filter((item) => item.status === 'overwrite').length;
  const newCount = items.length - overwriteCount;

  return {
    items,
    totalCount: records.length, // Req 6.1
    newCount, // Req 6.4
    overwriteCount, // Req 6.4
    minDate: records.length ? records[0].tanggal : null,
    maxDate: records.length ? records[records.length - 1].tanggal : null,
  };
};

// Bagi Daily_Record menjadi batch berukuran maksimum `size`.
// size <= 0 → pakai BATCH_SIZE. Gabungan berurutan seluruh batch = input utuh (Req 7.3, 7.7).
export const chunkDailyRecords = (dailyRecords, size = BATCH_SIZE) => {
  const records = Array.isArray(dailyRecords) ? dailyRecords : [];
  const step = size > 0 ? size : BATCH_SIZE;
  const batches = [];
  for (let i = 0; i < records.length; i += step) {
    batches.push(records.slice(i, i + step));
  }
  return batches;
};

// Helper murni pembentuk payload upsert school_calendar.
// Payload identik skema Manual_Entry (Req 7.2, 8.3, 9.1).
export const buildUpsertPayload = (records, nowIso) => {
  const list = Array.isArray(records) ? records : [];
  return list.map((r) => ({
    tanggal: r.tanggal,
    is_libur: true,
    keterangan: r.keterangan ?? null,
    updated_at: nowIso,
  }));
};
