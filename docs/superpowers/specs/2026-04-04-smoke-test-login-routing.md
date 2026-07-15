# Smoke Test - Login Routing per Role

Durasi target: 5-8 menit

## Tujuan

Memastikan routing setelah login sesuai rule terbaru:
- `admin` langsung ke dashboard admin (bukan portal),
- `piket` langsung ke dashboard piket (bukan portal),
- `tu` langsung ke workspace pembiasaan,
- role multi-workspace tetap ke portal jika memang berlaku.

## Prasyarat

1. Browser dalam kondisi bersih (private window disarankan).
2. Session lama dihapus (logout dulu sebelum ganti akun).
3. Akun uji tersedia: `admin`, `piket`, `tu`, `kaprog`, `guru`.

## Step Uji Cepat

### Step 1 - Admin

1. Login sebagai `admin`.
2. Verifikasi URL awal bukan `/portal`.
3. Verifikasi masuk ke dashboard admin (menu admin terlihat).

Expected: PASS jika admin tidak melewati portal.

### Step 2 - Piket

1. Logout.
2. Login sebagai `piket`.
3. Verifikasi URL awal ke dashboard piket (bukan `/portal`).
4. Verifikasi menu piket terlihat (`Koreksi Absen`, `Layanan Piket`, `Histori Layanan`).

Expected: PASS jika piket tidak melewati portal.

### Step 3 - TU

1. Logout.
2. Login sebagai `tu`.
3. Verifikasi langsung ke `/pembiasaan`.
4. Verifikasi menu pembiasaan tersedia (`Dashboard Pembiasaan`, `Sapa Pagi`, `Pembiasaan`).

Expected: PASS jika TU masuk langsung ke workspace pembiasaan.

### Step 4 - Kaprog

1. Logout.
2. Login sebagai `kaprog`.
3. Verifikasi behavior sesuai role matrix aktif:
   - jika multi-workspace aktif -> boleh masuk `/portal`,
   - jika single route -> langsung ke route utama role.

Expected: PASS jika tidak salah arah ke dashboard yang bukan hak role.

### Step 5 - Guru

1. Logout.
2. Login sebagai `guru` (mapel/non-mapel sesuai data uji).
3. Verifikasi route awal konsisten dengan flag akses mapel/pembiasaan pada akun tersebut.

Expected: PASS jika routing sesuai profile user.

## Template Hasil (isi cepat)

- Admin: PASS/FAIL - catatan
- Piket: PASS/FAIL - catatan
- TU: PASS/FAIL - catatan
- Kaprog: PASS/FAIL - catatan
- Guru: PASS/FAIL - catatan

## Failure Guide (jika FAIL)

1. Catat role + URL awal setelah login.
2. Catat URL setelah 2 detik (cek redirect berantai).
3. Screenshot sidebar menu yang muncul.
4. Laporkan bersama timestamp uji.
