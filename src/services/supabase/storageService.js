import { supabase } from './client';

const BUKTI_ABSEN_BUCKET = 'bukti-absen';
const MAPEL_SESSION_FOLDER = 'kbm';

export const uploadBuktiAbsen = async (fileName, file) => {
  const { error } = await supabase.storage.from(BUKTI_ABSEN_BUCKET).upload(fileName, file);
  if (error) throw error;

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUKTI_ABSEN_BUCKET).getPublicUrl(fileName);

  return publicUrl;
};

export const uploadMapelSessionPhoto = async ({ sessionId, phase, file, metadata }) => {
  if (!sessionId) throw new Error('sessionId wajib diisi');
  if (!phase) throw new Error('phase wajib diisi');
  if (!(file instanceof File)) throw new Error('file foto tidak valid');

  const normalizedPhase = phase === 'check_out' ? 'check-out' : 'check-in';
  const extension = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const filePath = `${MAPEL_SESSION_FOLDER}/${sessionId}/${normalizedPhase}-${Date.now()}.${extension}`;

  const { error } = await supabase.storage.from(BUKTI_ABSEN_BUCKET).upload(filePath, file, {
    cacheControl: '3600',
    contentType: file.type || 'image/jpeg',
    upsert: false,
  });
  if (error) throw error;

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUKTI_ABSEN_BUCKET).getPublicUrl(filePath);

  const compressionMode = metadata?.mode ?? null;
  const oversizeEmergency = Boolean(metadata?.oversizeEmergency);
  const normalizedMetadata = metadata
    ? {
        ...metadata,
        compressionMode,
        oversizeEmergency,
      }
    : {
        compressionMode,
        oversizeEmergency,
      };

  return {
    publicUrl,
    filePath,
    metadata: normalizedMetadata,
  };
};
