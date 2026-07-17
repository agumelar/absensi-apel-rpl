import { supabase } from './supabase/client.js';
import {
  BATCH_SIZE,
  chunkDailyRecords,
  buildUpsertPayload,
} from '../features/admin/utils/calendarUploadRules.js';

const toDateOnly = (value) => String(value ?? '').trim().slice(0, 10);

// Ambil tanggal yang sudah ada di school_calendar dalam rentang minDate..maxDate.
// Satu query rentang untuk menekan jumlah panggilan Supabase (hemat free-tier, Req 6.3).
// Bila minDate/maxDate falsy, kembalikan Set kosong tanpa melakukan query.
export const fetchExistingCalendarDates = async ({
  minDate,
  maxDate,
  supabaseClient = supabase,
} = {}) => {
  if (!minDate || !maxDate) return new Set();

  const { data, error } = await supabaseClient
    .from('school_calendar')
    .select('tanggal')
    .gte('tanggal', minDate)
    .lte('tanggal', maxDate);

  if (error) throw error;

  return new Set((data || []).map((r) => toDateOnly(r.tanggal)));
};

// Guard skema payload sebelum menulis (Req 8.6): setiap baris wajib punya
// `tanggal` (ISO_Date) dan `is_libur === true`. Bila tidak, lempar sebelum menulis.
const assertPayloadSchema = (payload) => {
  payload.forEach((row, index) => {
    const tanggal = toDateOnly(row?.tanggal);
    if (!tanggal || !/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
      throw new Error(
        `Payload baris ke-${index + 1} tidak memiliki tanggal yang valid. Penulisan dibatalkan.`,
      );
    }
    if (row?.is_libur !== true) {
      throw new Error(
        `Payload baris ke-${index + 1} bukan hari libur (is_libur harus true). Penulisan dibatalkan.`,
      );
    }
  });
};

// Tulis seluruh Daily_Record ke school_calendar secara batch via upsert onConflict 'tanggal'.
// - Payload dibentuk lewat buildUpsertPayload agar konsisten dengan skema Manual_Entry (Req 7.2, 8.3).
// - Satu stempel waktu (nowIso) dipakai untuk seluruh operasi.
// - Bila sebuah batch gagal, lempar Error Bahasa Indonesia yang menyebut penyebabnya (Req 7.5).
// Mengembalikan { writtenCount } bila seluruh batch berhasil.
export const batchUpsertSchoolCalendar = async ({
  dailyRecords,
  batchSize = BATCH_SIZE,
  supabaseClient = supabase,
} = {}) => {
  const nowIso = new Date().toISOString();
  const batches = chunkDailyRecords(dailyRecords, batchSize);

  let writtenCount = 0;

  for (let i = 0; i < batches.length; i += 1) {
    const batch = batches[i];
    const payload = buildUpsertPayload(batch, nowIso);

    // Verifikasi konsistensi skema sebelum menulis (Req 8.6).
    assertPayloadSchema(payload);

    const { error } = await supabaseClient
      .from('school_calendar')
      .upsert(payload, { onConflict: 'tanggal' });

    if (error) {
      throw new Error(
        `Gagal menyimpan batch ke-${i + 1} dari ${batches.length}: ${error.message}`,
      );
    }

    writtenCount += batch.length;
  }

  return { writtenCount };
};
