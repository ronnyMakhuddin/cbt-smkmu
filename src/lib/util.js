export const LETTERS = 'ABCDEFGHIJ'.split('');

export function randomPassword(len = 6) {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const arr = crypto.getRandomValues(new Uint32Array(len));
  return Array.from(arr, (n) => chars[n % chars.length]).join('');
}

export function randomToken(len = 6) {
  return randomPassword(len);
}

export function fmtDate(d, withTime = true) {
  if (!d) return '-';
  const o = { day: '2-digit', month: 'short', year: 'numeric' };
  if (withTime) Object.assign(o, { hour: '2-digit', minute: '2-digit' });
  return new Date(d).toLocaleString('id-ID', o);
}

/** ISO -> nilai input datetime-local */
export function toLocalInput(d) {
  if (!d) return '';
  const x = new Date(d);
  const pad = (n) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`;
}

export function fromLocalInput(v) {
  return v ? new Date(v).toISOString() : null;
}

export const TIPE_LABEL = {
  pg: 'Pilihan Ganda',
  mcma: 'PG Kompleks (MCMA)',
  kategori: 'PG Kompleks Kategori',
};

export function isAnswered(soal, jaw) {
  if (jaw == null) return false;
  if (soal.tipe === 'pg') return typeof jaw === 'string' && jaw !== '';
  if (soal.tipe === 'mcma') return Array.isArray(jaw) && jaw.length > 0;
  if (soal.tipe === 'kategori') return jaw && Object.keys(jaw).length === soal.opsi.length;
  return false;
}
