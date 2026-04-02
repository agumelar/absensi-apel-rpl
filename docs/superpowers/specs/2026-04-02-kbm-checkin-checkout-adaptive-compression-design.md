# KBM Check-in/Check-out Adaptive Compression Design

## Context
- Workspace KBM saat ini sudah relatif mudah dipakai, tetapi alur check-in/check-out masih rentan gagal pada beberapa perangkat karena kompresi dipaksa ketat di target 10KB.
- Constraint utama: Supabase free-tier dengan batas storage, sehingga ukuran file tetap harus dijaga disiplin.
- Kebutuhan operasional: guru tetap bisa mengambil foto kondisi kelas secara natural (tidak dipaksa terlalu dekat), lalu sistem mengolah ukuran file otomatis agar proses tetap lancar.

## Goals
- Menurunkan kegagalan check-in/check-out yang disebabkan oleh proses kompresi ketat.
- Menjaga mayoritas hasil upload tetap kecil agar aman untuk kuota storage free-tier.
- Menjaga kualitas bukti visual agar konteks ruang kelas tetap terbaca.
- Menyatukan alur check-in/check-out agar konsisten dan mudah dipahami user.

## Non-Goals
- Tidak mengubah model data utama sesi mapel secara besar.
- Tidak menambah ketergantungan pihak ketiga baru untuk image processing.
- Tidak membangun pipeline media server-side yang kompleks.

## Chosen Approach
Pendekatan yang dipilih adalah **Adaptive Ladder + Emergency Save**:

1. Sistem tetap menargetkan ukuran ideal 10KB sebagai level pertama.
2. Jika gagal, sistem mencoba ladder bertahap sampai 30KB.
3. Jika semua level normal gagal, sistem masuk mode darurat sampai 50KB dan tetap menyimpan foto agar operasi tidak macet.
4. Kasus darurat ditandai eksplisit (`oversize_emergency`) untuk monitoring dan evaluasi biaya.

Pendekatan ini dipilih karena paling seimbang antara reliability operasional, kebutuhan bukti visual, dan kontrol kuota storage.

## Flow Design

### 1) Capture-first UX
- Guru mengambil foto sekali untuk check-in/check-out.
- Sistem langsung memproses foto di belakang layar tanpa membebani user dengan retake sebagai default.

### 2) Compression Ladder
- Urutan target normal: `10KB -> 15KB -> 20KB -> 25KB -> 30KB`.
- Jika belum lolos semua level normal, lanjut emergency: `40KB -> 50KB`.
- Sistem menerapkan kombinasi adaptif antara penurunan kualitas JPEG dan penurunan dimensi.

### 3) Success/Failure Contract
- **Success normal:** file berhasil <=30KB.
- **Success emergency:** file tersimpan >30KB dan <=50KB, ditandai `oversize_emergency=true`.
- **Fail total:** hanya jika ada error teknis fatal (mis. upload gagal setelah retry), bukan karena ukuran awal foto besar.

### 4) Check-in & Check-out Consistency
- Strategi kompresi, retry, dan feedback user dibuat identik untuk check-in dan check-out.
- Tujuan: mengurangi beban belajar user dan mencegah kebingungan antar langkah.

## Quality Rules
- Kombinasi adaptif kualitas + resolusi diprioritaskan agar konteks kelas tetap terlihat.
- Tetapkan batas minimum dimensi agar foto tidak jatuh menjadi thumbnail yang kehilangan konteks ruang.
- Hindari instruksi default "foto lebih dekat"; digunakan hanya bila terjadi gagal teknis berulang.

## Data & Observability

### Metadata yang disimpan per foto
- `original_size_bytes`
- `final_size_bytes`
- `attempt_level`
- `final_width`
- `final_height`
- `compression_mode` (`normal`/`emergency`)
- `oversize_emergency` (boolean)

### Monitoring operasional
- Distribusi ukuran upload mingguan:
  - bucket A: `<=10KB`
  - bucket B: `11-30KB`
  - bucket C: `31-50KB`
- Alert bila rasio bucket C melewati ambang (contoh awal: 20%).

## Error Handling
- Retry upload 1-2 kali dengan jeda singkat.
- Pesan user dibedakan jelas:
  - sukses normal: foto tersimpan optimal,
  - sukses emergency: foto tersimpan dengan mode darurat,
  - gagal teknis: koneksi/penyimpanan bermasalah, coba ulang.
- Error teknis detail tetap dicatat untuk debugging internal.

## Technical Changes (Planned)

### `src/shared/utils/compressor.js`
- Tambah engine adaptive ladder dengan output metadata lengkap.
- Return status mode: `normal`, `emergency`, atau `failed`.

### `src/services/supabase/storageService.js`
- Uploader menerima metadata kompresi dan menyimpan flag emergency.
- Pertahankan path bucket yang sudah ada agar kompatibel dengan data lama.

### `src/features/mapel/pages/MapelSessionPage.jsx`
- Ubah flow check-in/check-out ke capture-first + adaptive compression.
- Perbarui feedback status agar user tahu hasil normal vs darurat.

### (Opsional) Audit
- Log ringkas outcome kompresi untuk analisis device-specific issue.

## Acceptance Criteria
- Check-in/check-out tidak lagi gagal hanya karena target 10KB tidak tercapai.
- Mayoritas upload tetap berada pada rentang <=30KB.
- Kasus edge tetap bisa tersimpan sampai 50KB dengan flag emergency.
- UX guru tetap sederhana: foto -> proses -> tersimpan, tanpa retake berulang sebagai default.

## Risks and Mitigations
- **Risk:** porsi upload emergency meningkat dan mempercepat konsumsi storage.
  - **Mitigation:** aktifkan monitoring rasio emergency dan evaluasi tuning parameter mingguan.
- **Risk:** kualitas terlalu turun pada perangkat tertentu.
  - **Mitigation:** gunakan guard minimum dimensi dan tuning ladder berbasis data produksi.
- **Risk:** observability tidak cukup untuk analisis.
  - **Mitigation:** pastikan metadata outcome tersimpan konsisten.

## Rollout Plan
1. Implementasi adaptive ladder pada compressor + wiring ke flow sesi mapel.
2. Validasi lokal (`npm run lint`, `npm run build`, `npm test`).
3. Uji skenario perangkat low-end dan mid-range.
4. Deploy bertahap, pantau rasio emergency selama 1 minggu.
5. Tuning parameter jika rasio emergency terlalu tinggi.
