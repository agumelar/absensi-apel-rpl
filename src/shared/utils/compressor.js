import imageCompression from 'browser-image-compression';

export const compressImage = async (file) => {
  const options = {
    maxSizeMB: 0.11, // 0.11 MB = 110 KB
    maxWidthOrHeight: 800,
    useWebWorker: true,
  };

  try {
    console.log(`Ukuran awal: ${file.size / 1024} KB`);
    const compressedFile = await imageCompression(file, options);
    console.log(`Ukuran setelah kompres: ${compressedFile.size / 1024} KB`);
    return compressedFile;
  } catch (error) {
    console.error("Gagal kompres foto:", error);
    return file; // Kalau gagal, kirim file asli (aman)
  }
};