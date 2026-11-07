import { createClient } from '@supabase/supabase-js';

// Kunci publishable aman berada di frontend (data dilindungi RLS & fungsi database).
// Environment variable di Vercel tetap diprioritaskan bila diisi.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://dcqzkqihpqriakidwrfi.supabase.co';
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_a7a7ePukAn7GX8KYaFxDHQ_bSeqYTaa';

export const isConfigured = Boolean(url && key);
export const supabase = isConfigured
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;

/** Jalankan query supabase dan lempar error berbahasa Indonesia */
export async function q(promise) {
  const { data, error } = await promise;
  if (error) throw new Error(translateError(error.message));
  return data;
}

export async function rpc(fn, args) {
  return q(supabase.rpc(fn, args));
}

export function translateError(msg = '') {
  if (/Invalid login credentials/i.test(msg)) return 'Email atau password salah';
  if (/duplicate key.*nis/i.test(msg)) return 'NIS sudah terdaftar';
  if (/duplicate key.*kelas_nama/i.test(msg)) return 'Nama kelas sudah ada';
  if (/duplicate key/i.test(msg)) return 'Data sudah ada (duplikat)';
  if (/violates foreign key.*ujian_bank_id/i.test(msg)) return 'Bank soal masih dipakai oleh ujian';
  if (/Failed to fetch/i.test(msg)) return 'Koneksi internet bermasalah, coba lagi';
  return msg;
}

/** Ambil semua baris (melewati batas 1000 baris Supabase) */
export async function fetchAll(build, pageSize = 1000) {
  const out = [];
  for (let from = 0; ; from += pageSize) {
    const data = await q(build().range(from, from + pageSize - 1));
    out.push(...data);
    if (data.length < pageSize) break;
  }
  return out;
}
