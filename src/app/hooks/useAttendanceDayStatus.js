import { useEffect, useState } from 'react';

import {
  ATTENDANCE_DAY_OFF_MESSAGE,
  getAttendanceDayStatus,
} from '../../services/shared/attendanceDayService';

// Cek sekali apakah hari ini hari libur (weekend / kalender sekolah) untuk
// menampilkan banner libur global di seluruh workspace. Bila query gagal,
// banner tidak ditampilkan (fail-safe, tidak mengganggu operasional).
const useAttendanceDayStatus = () => {
  const [isDayOff, setIsDayOff] = useState(false);
  const [message, setMessage] = useState(ATTENDANCE_DAY_OFF_MESSAGE);

  useEffect(() => {
    let isCancelled = false;

    getAttendanceDayStatus({})
      .then((status) => {
        if (isCancelled) return;
        setIsDayOff(!status.isActive);
        if (status?.message) setMessage(status.message);
      })
      .catch(() => {
        // Diamkan: jangan tampilkan banner bila status hari gagal diperiksa.
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  return { isDayOff, message };
};

export default useAttendanceDayStatus;
