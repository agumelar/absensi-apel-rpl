import { supabase } from './client';

const BUKTI_ABSEN_BUCKET = 'bukti-absen';

export const uploadBuktiAbsen = async (fileName, file) => {
  const { error } = await supabase.storage.from(BUKTI_ABSEN_BUCKET).upload(fileName, file);
  if (error) throw error;

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUKTI_ABSEN_BUCKET).getPublicUrl(fileName);

  return publicUrl;
};
