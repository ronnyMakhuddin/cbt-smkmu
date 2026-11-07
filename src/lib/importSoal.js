import { LETTERS } from './util';

export const TEMPLATE_SOAL = [
  { tipe: 'PG', pertanyaan: 'Hasil dari $\\frac{3}{4} + \\frac{1}{4}$ adalah ...', gambar: '', opsi_a: '1', opsi_b: '$\\frac{1}{2}$', opsi_c: '2', opsi_d: '$\\frac{3}{8}$', opsi_e: '0', kunci: 'A', label: '', bobot: 1 },
  { tipe: 'MCMA', pertanyaan: 'Manakah yang termasuk perangkat input? (jawaban lebih dari satu)', gambar: '', opsi_a: 'Keyboard', opsi_b: 'Monitor', opsi_c: 'Mouse', opsi_d: 'Printer', opsi_e: 'Scanner', kunci: 'A,C,E', label: '', bobot: 2 },
  { tipe: 'KATEGORI', pertanyaan: 'Tentukan Benar atau Salah pernyataan berikut tentang jaringan komputer.', gambar: '', opsi_a: 'LAN mencakup area lokal', opsi_b: 'IP address versi 4 terdiri dari 64 bit', opsi_c: 'Switch bekerja di layer 2 OSI', opsi_d: '', opsi_e: '', kunci: 'B,S,B', label: 'Benar/Salah', bobot: 2 },
  { tipe: 'KATEGORI', pertanyaan: 'Tentukan kesesuaian pernyataan berikut dengan teks.', gambar: '', opsi_a: 'Pernyataan pertama', opsi_b: 'Pernyataan kedua', opsi_c: '', opsi_d: '', opsi_e: '', kunci: 'Sesuai,Tidak Sesuai', label: 'Sesuai/Tidak Sesuai', bobot: 2 },
];

const initials = (s) => s.split(/\s+/).map((w) => w[0]).join('').toUpperCase();

function matchLabel(token, labels) {
  const t = token.trim().toUpperCase();
  for (const l of labels) if (t === l.toUpperCase() || t === initials(l)) return l;
  return null;
}

/** Ubah baris excel menjadi objek soal. Lempar error jika tidak valid. */
export function rowToSoal(r, idx) {
  const n = idx + 2; // nomor baris di excel
  const tipeRaw = (r.tipe || 'PG').toUpperCase().replace(/\s+/g, '');
  const tipe = tipeRaw.startsWith('MCMA') || tipeRaw === 'PGK' ? 'mcma' : tipeRaw.startsWith('KAT') || tipeRaw === 'BS' ? 'kategori' : 'pg';
  let pertanyaan = r.pertanyaan || r.soal || '';
  if (!pertanyaan) throw new Error(`Baris ${n}: pertanyaan kosong`);
  if (r.gambar) pertanyaan += `\n![gambar](${r.gambar})`;
  const teksOpsi = LETTERS.slice(0, 10).map((L) => r['opsi_' + L.toLowerCase()] || r[L.toLowerCase()] || '').filter(Boolean);
  if (!teksOpsi.length) throw new Error(`Baris ${n}: opsi kosong`);
  const kunciRaw = (r.kunci || '').trim();
  if (!kunciRaw) throw new Error(`Baris ${n}: kunci kosong`);
  const bobot = Number(r.bobot) > 0 ? Number(r.bobot) : 1;

  if (tipe === 'kategori') {
    const labels = (r.label || 'Benar/Salah').split('/').map((s) => s.trim()).filter(Boolean).slice(0, 2);
    if (labels.length < 2) throw new Error(`Baris ${n}: label kategori harus 2, contoh Benar/Salah`);
    const opsi = teksOpsi.map((teks, i) => ({ id: String(i + 1), teks }));
    const toks = kunciRaw.split(/[,;|]/);
    if (toks.length !== opsi.length) throw new Error(`Baris ${n}: jumlah kunci (${toks.length}) tidak sama dengan jumlah pernyataan (${opsi.length})`);
    const kunci = {};
    toks.forEach((t, i) => {
      const l = matchLabel(t, labels);
      if (!l) throw new Error(`Baris ${n}: kunci "${t}" tidak cocok dengan label ${labels.join('/')}`);
      kunci[opsi[i].id] = l;
    });
    return { tipe, pertanyaan, opsi, kunci, label_kategori: labels, bobot };
  }

  const opsi = teksOpsi.map((teks, i) => ({ id: LETTERS[i], teks }));
  const ids = kunciRaw.toUpperCase().split(/[,;| ]+/).filter(Boolean);
  for (const k of ids) if (!opsi.find((o) => o.id === k)) throw new Error(`Baris ${n}: kunci "${k}" tidak ada di opsi`);
  if (tipe === 'pg') {
    if (ids.length !== 1) throw new Error(`Baris ${n}: PG hanya boleh 1 kunci`);
    return { tipe, pertanyaan, opsi, kunci: ids[0], label_kategori: ['Benar', 'Salah'], bobot };
  }
  return { tipe, pertanyaan, opsi, kunci: ids, label_kategori: ['Benar', 'Salah'], bobot };
}

export function soalToRow(s) {
  const row = { tipe: s.tipe === 'pg' ? 'PG' : s.tipe === 'mcma' ? 'MCMA' : 'KATEGORI', pertanyaan: s.pertanyaan, gambar: '' };
  LETTERS.slice(0, 5).forEach((L, i) => (row['opsi_' + L.toLowerCase()] = s.opsi[i]?.teks || ''));
  if (s.tipe === 'pg') row.kunci = s.kunci;
  else if (s.tipe === 'mcma') row.kunci = (s.kunci || []).join(',');
  else row.kunci = s.opsi.map((o) => s.kunci?.[o.id] || '').join(',');
  row.label = s.tipe === 'kategori' ? s.label_kategori.join('/') : '';
  row.bobot = s.bobot;
  return row;
}
