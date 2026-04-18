import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDetailHistoryExportRows,
  buildDailyMonitoringExportRows,
  buildDailyMonitoringRows,
  buildTeacherRecapRows,
  formatCheckinAtToWIB,
} from './executivePembiasaanReportRules.js';

test('buildDailyMonitoringRows keeps selected date and status', () => {
  const rows = [
    { id: '1', tanggal: '2026-04-06', nama_lengkap: 'Budi', status: 'hadir', checkin_at: '2026-04-06T06:10:00.000Z' },
    { id: '2', tanggal: '2026-04-06', nama_lengkap: 'Andi', status: 'izin', checkin_at: null },
    { id: '3', tanggal: '2026-04-07', nama_lengkap: 'Citra', status: 'hadir', checkin_at: '2026-04-07T06:00:00.000Z' },
  ];

  const result = buildDailyMonitoringRows(rows, { focusDate: '2026-04-06', status: 'izin' });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, '2');
});

test('buildDailyMonitoringRows sorts checkin first then name', () => {
  const rows = [
    { id: '1', tanggal: '2026-04-06', nama_lengkap: 'Citra', status: 'hadir', checkin_at: null },
    { id: '2', tanggal: '2026-04-06', nama_lengkap: 'Budi', status: 'hadir', checkin_at: '2026-04-06T06:20:00.000Z' },
    { id: '3', tanggal: '2026-04-06', nama_lengkap: 'Andi', status: 'hadir', checkin_at: '2026-04-06T06:10:00.000Z' },
  ];

  const result = buildDailyMonitoringRows(rows, { focusDate: '2026-04-06', status: 'all' });
  assert.deepEqual(
    result.map((row) => row.id),
    ['3', '2', '1'],
  );
});

test('formatCheckinAtToWIB converts UTC value into WIB hour-minute', () => {
  const result = formatCheckinAtToWIB('2026-04-05T23:00:00.000Z');
  assert.equal(result, '06:00');
});

test('formatCheckinAtToWIB returns dash for empty value', () => {
  const result = formatCheckinAtToWIB(null);
  assert.equal(result, '-');
});

test('buildDailyMonitoringExportRows formats Jam as WIB', () => {
  const rows = [
    {
      tanggal: '2026-04-06',
      activity_type: 'pembiasaan',
      nama_lengkap: 'Guru A',
      role: 'guru',
      status: 'hadir',
      checkin_at: '2026-04-05T23:00:00.000Z',
      distance_meter: 12.5,
      note: null,
    },
  ];

  const result = buildDailyMonitoringExportRows(rows);

  assert.deepEqual(result, [
    {
      Tanggal: '2026-04-06',
      Aktivitas: 'Pembiasaan',
      Nama: 'Guru A',
      Role: 'Guru',
      Status: 'Hadir',
      Jam: '06:00',
      'Jarak (m)': 12.5,
      Catatan: '-',
    },
  ]);
});

test('buildDailyMonitoringExportRows formats known labels to human readable text', () => {
  const rows = [
    {
      tanggal: '2026-04-06',
      activity_type: 'sapa_pagi',
      nama_lengkap: 'Petugas TU',
      role: 'tu',
      status: 'izin',
      checkin_at: null,
      distance_meter: null,
      note: 'izin acara dinas',
    },
  ];

  const result = buildDailyMonitoringExportRows(rows);

  assert.deepEqual(result, [
    {
      Tanggal: '2026-04-06',
      Aktivitas: 'Sapa Pagi',
      Nama: 'Petugas TU',
      Role: 'TU',
      Status: 'Izin',
      Jam: '-',
      'Jarak (m)': '-',
      Catatan: 'izin acara dinas',
    },
  ]);
});

test('buildDetailHistoryExportRows maps detail rows into readable export headers', () => {
  const rows = [
    {
      id: 7,
      tanggal: '2026-04-06',
      activity_type: 'sapa_pagi',
      user_id: 'u7',
      nama_lengkap: 'Ibu Maya',
      role: 'walikelas',
      jurusan_id_snapshot: 2,
      nama_jurusan: 'TKJ',
      status: 'alpha',
      checkin_at: '2026-04-05T23:05:00.000Z',
      note: '',
      photo_path: 'pembiasaan/sapa/u7.jpg',
      photo_size_kb: 128,
      lat: -7.12,
      lng: 110.3,
      distance_meter: 45.6,
      is_within_radius: true,
      evidence_source: 'rear_camera',
      created_by_system: false,
      created_at: null,
      updated_at: null,
    },
  ];

  const result = buildDetailHistoryExportRows(rows);

  assert.deepEqual(result, [
    {
      ID: 7,
      Tanggal: '2026-04-06',
      Aktivitas: 'Sapa Pagi',
      'ID User': 'u7',
      Nama: 'Ibu Maya',
      Role: 'Wali Kelas',
      'ID Jurusan': 2,
      Jurusan: 'TKJ',
      Status: 'Alpha',
      Jam: '06:05',
      Catatan: '-',
      Foto: 'pembiasaan/sapa/u7.jpg',
      'Ukuran Foto (KB)': 128,
      Latitude: -7.12,
      Longitude: 110.3,
      'Jarak (m)': 45.6,
      'Dalam Radius': 'Ya',
      'Sumber Bukti': 'Kamera Belakang',
      'Dibuat Sistem': 'Tidak',
      'Waktu Dibuat': '-',
      'Waktu Diperbarui': '-',
    },
  ]);
});

test('buildTeacherRecapRows computes aktual, kewajiban and kepatuhan', () => {
  const rows = [
    { user_id: 'u1', nama_lengkap: 'Guru A', status: 'hadir' },
    { user_id: 'u1', nama_lengkap: 'Guru A', status: 'alpha' },
    { user_id: 'u2', nama_lengkap: 'Guru B', status: 'izin' },
  ];

  const participants = [
    { id: 'u1', nama_lengkap: 'Guru A' },
    { id: 'u2', nama_lengkap: 'Guru B' },
    { id: 'u3', nama_lengkap: 'Guru C' },
  ];

  const obligationsByUserId = { u1: 4, u2: 2, u3: 3 };

  const result = buildTeacherRecapRows({ rows, participants, obligationsByUserId });
  const guruA = result.find((item) => item.user_id === 'u1');
  const guruC = result.find((item) => item.user_id === 'u3');

  assert.equal(guruA.total_aktual, 2);
  assert.equal(guruA.total_kewajiban, 4);
  assert.equal(guruA.kepatuhan_persen, 50);
  assert.equal(guruC.total_aktual, 0);
  assert.equal(guruC.total_kewajiban, 3);
});
