const KEY = 'cbt_siswa';
export const getSiswa = () => {
  try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; }
};
export const setSiswa = (s) => localStorage.setItem(KEY, JSON.stringify(s));
export const clearSiswa = () => localStorage.removeItem(KEY);
export const isSessionError = (e) => /SESI_TIDAK_VALID/.test(e?.message || '');
