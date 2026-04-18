import { supabase } from '../supabase/client.js';
import { getTodayDateWIB } from './dateService.js';

export const ATTENDANCE_DAY_OFF_MESSAGE = 'Tidak ada aktifitas absensi hari ini, selamat berlibur';

const toDateOnly = (value) => String(value || '').trim().slice(0, 10);

const isBusinessWeekdayWIBDate = (dateValue) => {
  if (!dateValue) return true;
  const parsed = new Date(`${toDateOnly(dateValue)}T12:00:00+07:00`);
  if (Number.isNaN(parsed.getTime())) return true;
  const isoDay = ((parsed.getUTCDay() + 6) % 7) + 1;
  return isoDay >= 1 && isoDay <= 5;
};

export const getAttendanceDayStatus = async ({ tanggal, supabaseClient = supabase } = {}) => {
  const targetDate = toDateOnly(tanggal || getTodayDateWIB());

  if (!isBusinessWeekdayWIBDate(targetDate)) {
    return {
      isActive: false,
      reason: 'weekend',
      date: targetDate,
      message: ATTENDANCE_DAY_OFF_MESSAGE,
    };
  }

  const { data, error } = await supabaseClient.from('school_calendar').select('is_libur').eq('tanggal', targetDate).maybeSingle();
  if (error) throw error;

  if (data?.is_libur) {
    return {
      isActive: false,
      reason: 'holiday',
      date: targetDate,
      message: ATTENDANCE_DAY_OFF_MESSAGE,
    };
  }

  return {
    isActive: true,
    reason: 'active',
    date: targetDate,
    message: ATTENDANCE_DAY_OFF_MESSAGE,
  };
};

export const isAttendanceDayActive = async (options = {}) => {
  const status = await getAttendanceDayStatus(options);
  return status.isActive;
};
