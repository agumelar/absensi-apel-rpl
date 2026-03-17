const DEFAULT_MAX_KB = 110;
const EXTREME_TARGET_KB = 10;

const toBytes = (kb) => Math.max(1, Math.floor(kb * 1024));

const blobToFile = (blob, fileName) =>
  new File([blob], fileName, {
    type: 'image/jpeg',
    lastModified: Date.now(),
  });

const canvasToBlob = (canvas, quality) =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Gagal mengubah canvas ke blob'));
          return;
        }
        resolve(blob);
      },
      'image/jpeg',
      quality,
    );
  });

const loadImageElement = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('File gambar tidak valid atau rusak'));
    };
    image.src = url;
  });

const createCanvas = (image, maxWidthOrHeight) => {
  const ratio = Math.min(1, maxWidthOrHeight / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * ratio));
  const height = Math.max(1, Math.round(image.height * ratio));
  const canvas = document.createElement('canvas');

  canvas.width = width;
  canvas.height = height;

  return { canvas, width, height };
};

const drawImage = (canvas, image, grayscale) => {
  const context = canvas.getContext('2d', { alpha: false });
  context.filter = grayscale ? 'grayscale(100%)' : 'none';
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  context.filter = 'none';
};

const downscaleCanvas = (canvas, factor = 0.85) => {
  const nextCanvas = document.createElement('canvas');
  nextCanvas.width = Math.max(1, Math.round(canvas.width * factor));
  nextCanvas.height = Math.max(1, Math.round(canvas.height * factor));

  const ctx = nextCanvas.getContext('2d', { alpha: false });
  ctx.drawImage(canvas, 0, 0, nextCanvas.width, nextCanvas.height);

  return nextCanvas;
};

export const compressImageWithMeta = async (
  file,
  {
    targetKB = DEFAULT_MAX_KB,
    maxWidthOrHeight = 800,
    grayscale = false,
    strict = false,
    minQuality = 0.08,
    initialQuality = 0.48,
    maxAttempts = 14,
  } = {},
) => {
  if (!(file instanceof File)) {
    throw new Error('Input kompresi harus berupa file gambar');
  }

  const targetBytes = toBytes(targetKB);
  const image = await loadImageElement(file);
  const { canvas } = createCanvas(image, maxWidthOrHeight);
  drawImage(canvas, image, grayscale);

  let currentCanvas = canvas;
  let bestBlob = null;
  let bestQuality = initialQuality;
  let attempts = 0;

  for (let quality = initialQuality; quality >= minQuality && attempts < maxAttempts; quality -= 0.04) {
    attempts += 1;
    const blob = await canvasToBlob(currentCanvas, Number(quality.toFixed(2)));
    bestBlob = blob;
    bestQuality = Number(quality.toFixed(2));

    if (blob.size <= targetBytes) {
      break;
    }

    if (quality <= minQuality + 0.001) {
      currentCanvas = downscaleCanvas(currentCanvas, 0.82);
      quality = initialQuality + 0.04;
    }
  }

  const finalBlob = bestBlob ?? (await canvasToBlob(currentCanvas, minQuality));
  const compressedFile = blobToFile(finalBlob, file.name.replace(/\.\w+$/, '') + '.jpg');
  const isTargetMet = compressedFile.size <= targetBytes;

  if (strict && !isTargetMet) {
    throw new Error(
      `Ukuran foto masih ${(compressedFile.size / 1024).toFixed(1)}KB, target maksimal ${targetKB}KB. Coba ambil ulang foto dengan jarak lebih dekat.`,
    );
  }

  return {
    file: compressedFile,
    metadata: {
      originalSizeBytes: file.size,
      compressedSizeBytes: compressedFile.size,
      originalWidth: image.width,
      originalHeight: image.height,
      finalWidth: currentCanvas.width,
      finalHeight: currentCanvas.height,
      quality: bestQuality,
      targetKB,
      targetBytes,
      isTargetMet,
      grayscale,
      attempts,
    },
  };
};

export const compressImage = async (file, options = {}) => {
  const { file: compressedFile } = await compressImageWithMeta(file, {
    targetKB: DEFAULT_MAX_KB,
    maxWidthOrHeight: 800,
    grayscale: false,
    strict: false,
    ...options,
  });

  return compressedFile;
};

export const compressImageExtreme = async (file, options = {}) =>
  compressImageWithMeta(file, {
    targetKB: EXTREME_TARGET_KB,
    maxWidthOrHeight: 640,
    grayscale: true,
    strict: true,
    ...options,
  });
