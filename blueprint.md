# Blueprint Aplikasi Absensi

Dokumen ini adalah sumber kebenaran tunggal untuk pengembangan aplikasi absensi.

## Tujuan Aplikasi

Aplikasi ini bertujuan untuk memungkinkan wali kelas melakukan absensi siswa secara digital, mencatat status kehadiran, dan menyimpan bukti jika diperlukan, dengan antarmuka yang modern dan mudah digunakan.

## Fitur yang Diimplementasikan (Versi 2.0 - Perbaikan & Peningkatan UI)

*   **Desain & UI Modern:**
    *   Antarmuka pengguna (UI) yang bersih, modern, dan *mobile-first* menggunakan Tailwind CSS.
    *   Penggunaan ikon dari `lucide-react` (Camera, Clock, User, dll.) untuk memperjelas aksi dan informasi.
    *   Tombol status yang interaktif dengan efek *scale* dan perubahan warna yang jelas saat dipilih.
    *   Tombol simpan utama yang *fixed* di bagian bawah layar untuk aksesibilitas maksimal di perangkat mobile.
    *   Tampilan *loading* dan *saving* yang informatif dengan animasi ikon.
*   **Logika State yang Efisien:**
    *   Struktur state `absensi` yang lebih baik, menyimpan semua informasi (status, jam, bukti, siswa_id) dalam satu objek per siswa, mencegah kesalahan data.
*   **Alur Pengguna yang Disempurnakan:**
    *   Formulir unggah file untuk 'Sakit' dan 'Izin' dengan desain *drag-and-drop* (visual) yang intuitif.
    *   Input jam yang terintegrasi rapi untuk status 'Kesiangan'.
    *   Notifikasi yang jelas untuk keberhasilan kompresi foto, penyimpanan, dan error.
*   **Fungsionalitas Inti (Terverifikasi):**
    *   **Pengambilan Data Siswa:** Mengambil daftar siswa dari tabel `siswa` Supabase.
    *   **Kompresi Gambar:** Gambar bukti dikompresi di sisi klien (<10KB) sebelum diunggah.
    *   **Penyimpanan Data Lengkap:**
        *   Menyimpan `siswa_id`, `status`, `jam_hadir`, `bukti_url`, dan `tanggal` ke tabel `absensi` Supabase (dengan nama kolom yang sudah diverifikasi).
        *   File bukti diunggah ke *bucket* `bukti-absen` di Supabase Storage.
    *   **Reset Otomatis:** Formulir dan pilihan status otomatis kembali ke keadaan semula setelah penyimpanan berhasil.

## Status Saat Ini

**Sangat Stabil.** Aplikasi berada dalam kondisi yang sangat baik dengan logika yang sudah diperbaiki dan UI yang jauh lebih superior. Semua fitur inti berfungsi sesuai harapan.

## Rencana Perubahan

*Menunggu permintaan fitur atau perbaikan berikutnya.*
