export const GEOLOCATION_ERROR_MESSAGE = {
  UNSUPPORTED: 'Browser tidak mendukung geolocation. Gunakan perangkat/browser yang mendukung GPS.',
  PERMISSION_DENIED: 'Izin lokasi ditolak. Aktifkan izin lokasi browser lalu coba lagi.',
  POSITION_UNAVAILABLE: 'Lokasi tidak tersedia. Pastikan GPS aktif dan sinyal memadai.',
  TIMEOUT: 'Lokasi gagal diakses (timeout). Pastikan GPS aktif lalu coba lagi.',
  UNKNOWN: 'Lokasi gagal diakses. Aktifkan GPS lalu coba lagi.',
};

export const isValidGeoCoordinate = (value) => {
  if (value === null || value === undefined || value === '') return false;
  return Number.isFinite(Number(value));
};

export const getGeoLocationErrorMessage = (error) => {
  const code = Number(error?.code);
  if (code === 1) return GEOLOCATION_ERROR_MESSAGE.PERMISSION_DENIED;
  if (code === 2) return GEOLOCATION_ERROR_MESSAGE.POSITION_UNAVAILABLE;
  if (code === 3) return GEOLOCATION_ERROR_MESSAGE.TIMEOUT;
  return GEOLOCATION_ERROR_MESSAGE.UNKNOWN;
};
