import { supabase } from './supabase';

/** Perkecil gambar ke maksimal 1280px agar hemat storage */
async function compress(file, max = 1280) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') return file;
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return file;
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  if (scale === 1 && file.size < 400_000) return file;
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  const blob = await new Promise((r) => c.toBlob(r, type, 0.85));
  return blob ? new File([blob], file.name, { type }) : file;
}

export async function uploadImage(file, folder = 'soal') {
  if (!file.type.startsWith('image/')) throw new Error('File harus berupa gambar');
  const f = await compress(file);
  const ext = (f.type.split('/')[1] || 'png').replace('jpeg', 'jpg').replace('svg+xml', 'svg');
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from('media').upload(path, f, { contentType: f.type, upsert: false });
  if (error) throw new Error('Upload gagal: ' + error.message);
  return supabase.storage.from('media').getPublicUrl(path).data.publicUrl;
}
