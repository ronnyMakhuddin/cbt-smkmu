import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Printer } from 'lucide-react';
import { supabase, q } from '../../lib/supabase';
import { Spinner, Field, useToast, useSettings } from '../../components/ui';
import RichText from '../../components/RichText';
import Kop, { hariTanggal, jam } from '../../components/Kop';
import { LETTERS } from '../../lib/util';

const kunciTeks = (s) => {
  if (s.tipe === 'pg') return s.kunci;
  if (s.tipe === 'mcma') return (s.kunci || []).join(', ');
  return s.opsi.map((o, i) => `${i + 1}. ${s.kunci?.[o.id] || '-'}`).join('; ');
};

export default function CetakSoal() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const toast = useToast();
  const { settings } = useSettings();
  const [bank, setBank] = useState(null);
  const [soal, setSoal] = useState(null);
  const [opt, setOpt] = useState({ judul: '', kelas: '', tanggal: '', waktu: '', duaKolom: false, naskah: true, kunci: true, petunjuk: true, font: 13 });
  const set = (p) => setOpt((o) => ({ ...o, ...p }));

  useEffect(() => {
    (async () => {
      try {
        const [b, s] = await Promise.all([
          q(supabase.from('bank_soal').select('*, mapel(nama)').eq('id', id).single()),
          q(supabase.from('soal').select('*').eq('bank_id', id).order('urutan').order('created_at')),
        ]);
        setBank(b); setSoal(s);
        const uid = params.get('ujian');
        let u = null;
        if (uid) u = await q(supabase.from('ujian').select('nama, mulai, durasi_menit, kelas_ids').eq('id', uid).maybeSingle());
        let kelasNama = '';
        if (u?.kelas_ids?.length) {
          const k = await q(supabase.from('kelas').select('nama').in('id', u.kelas_ids));
          kelasNama = k.map((x) => x.nama).sort().join(', ');
        }
        set({
          judul: u?.nama || settings.judul_ujian || 'Penilaian Akhir Semester',
          kelas: kelasNama,
          tanggal: u?.mulai ? hariTanggal(u.mulai) : '',
          waktu: u ? `${u.mulai ? jam(u.mulai) + ' · ' : ''}${u.durasi_menit} menit` : '',
        });
      } catch (e) { toast.err(e); setSoal([]); }
    })();
  }, [id]);

  if (!soal) return <Spinner />;
  const ada = (t) => soal.some((s) => s.tipe === t);

  const Identitas = () => (
    <>
      <Kop />
      <div className="doc-title">{opt.judul}<br /><span style={{ fontSize: 12, fontWeight: 600, textTransform: 'none' }}>Tahun Ajaran {settings.tahun_ajaran} · Semester {settings.semester}</span></div>
      <table className="info" style={{ width: '100%', marginBottom: 10 }}>
        <tbody>
          <tr><td style={{ width: 120 }}>Mata Pelajaran</td><td>: {bank?.mapel?.nama || '-'}</td><td style={{ width: 110 }}>Hari/Tanggal</td><td>: {opt.tanggal || '....................'}</td></tr>
          <tr><td>Kelas</td><td>: {opt.kelas || '....................'}</td><td>Waktu</td><td>: {opt.waktu || '....................'}</td></tr>
        </tbody>
      </table>
    </>
  );

  return (
    <div>
      <div className="page-head no-print">
        <div className="row">
          <Link to={`/admin/bank/${id}`} className="btn ghost icon"><ArrowLeft size={18} /></Link>
          <div><h1>Cetak Soal</h1><div className="small muted">{bank?.nama} · {soal.length} soal</div></div>
        </div>
        <button className="btn" onClick={() => window.print()} disabled={!soal.length}><Printer size={17} /> Cetak / Simpan PDF</button>
      </div>

      <div className="clay mb no-print">
        <div className="grid g4" style={{ gap: 0, columnGap: 14 }}>
          <Field label="Judul"><input className="input" value={opt.judul} onChange={(e) => set({ judul: e.target.value })} /></Field>
          <Field label="Kelas"><input className="input" value={opt.kelas} onChange={(e) => set({ kelas: e.target.value })} /></Field>
          <Field label="Hari/Tanggal"><input className="input" value={opt.tanggal} onChange={(e) => set({ tanggal: e.target.value })} /></Field>
          <Field label="Waktu"><input className="input" value={opt.waktu} onChange={(e) => set({ waktu: e.target.value })} /></Field>
        </div>
        <div className="row" style={{ gap: 18 }}>
          <label className="check"><input type="checkbox" checked={opt.naskah} onChange={(e) => set({ naskah: e.target.checked })} /> Naskah soal</label>
          <label className="check"><input type="checkbox" checked={opt.kunci} onChange={(e) => set({ kunci: e.target.checked })} /> Kunci jawaban (halaman terpisah)</label>
          <label className="check"><input type="checkbox" checked={opt.petunjuk} onChange={(e) => set({ petunjuk: e.target.checked })} /> Petunjuk umum</label>
          <label className="check"><input type="checkbox" checked={opt.duaKolom} onChange={(e) => set({ duaKolom: e.target.checked })} /> Dua kolom</label>
          <label className="check">Ukuran huruf
            <input className="input" type="number" min="10" max="16" style={{ width: 70 }} value={opt.font} onChange={(e) => set({ font: Number(e.target.value) || 13 })} />
          </label>
        </div>
      </div>

      <div className="clay doc-wrap">
        {opt.naskah && (
          <div className={`doc ${opt.duaKolom ? 'two-col' : ''} ${opt.kunci ? 'page-break' : ''}`} style={{ fontSize: opt.font }}>
            <Identitas />
            {opt.petunjuk && (
              <div style={{ border: '1px solid #333', padding: '6px 10px', marginBottom: 12, fontSize: '0.92em' }}>
                <b>Petunjuk Umum:</b>
                <ol style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                  <li>Berdoalah sebelum mengerjakan soal.</li>
                  {ada('pg') && <li>Pilihan ganda: pilih <b>satu</b> jawaban yang paling tepat.</li>}
                  {ada('mcma') && <li>Pilihan ganda kompleks: pilih <b>semua</b> jawaban yang benar (bisa lebih dari satu).</li>}
                  {ada('kategori') && <li>Pilihan ganda kompleks kategori: tentukan kategori yang sesuai untuk <b>setiap</b> pernyataan.</li>}
                  <li>Periksa kembali jawaban sebelum dikumpulkan.</li>
                </ol>
              </div>
            )}
            <div className="soal-list">
              {soal.map((s, i) => (
                <div key={s.id} className="soal-item">
                  <div className="soal-no">{i + 1}.</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <RichText value={s.pertanyaan} />
                    {s.tipe === 'mcma' && <div style={{ fontStyle: 'italic', fontSize: '0.88em' }}>(Jawaban benar lebih dari satu)</div>}
                    {s.tipe === 'kategori' ? (
                      <table className="grid-t" style={{ marginTop: 6 }}>
                        <thead><tr><th style={{ width: 28 }}>No</th><th>Pernyataan</th>{s.label_kategori.map((l) => <th key={l} style={{ width: 80 }}>{l}</th>)}</tr></thead>
                        <tbody>
                          {s.opsi.map((o, j) => (
                            <tr key={o.id}><td style={{ textAlign: 'center' }}>{j + 1}</td><td><RichText value={o.teks} /></td>
                              {s.label_kategori.map((l) => <td key={l} style={{ textAlign: 'center' }}>☐</td>)}</tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div style={{ marginTop: 4 }}>
                        {s.opsi.map((o, j) => (
                          <div key={o.id} className="soal-opsi">
                            <span style={{ width: 22, flex: 'none' }}>{s.tipe === 'mcma' ? '☐' : `${LETTERS[j]}.`}</span>
                            {s.tipe === 'mcma' && <span style={{ width: 16, flex: 'none' }}>{LETTERS[j]}.</span>}
                            <RichText value={o.teks} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {opt.kunci && (
          <div className="doc" style={{ fontSize: opt.font, marginTop: opt.naskah ? 24 : 0 }}>
            <Kop />
            <div className="doc-title">Kunci Jawaban · {opt.judul}<br /><span style={{ fontSize: 12, fontWeight: 600, textTransform: 'none' }}>{bank?.mapel?.nama} · {bank?.nama}</span></div>
            <table className="grid-t">
              <thead><tr><th style={{ width: 40 }}>No</th><th style={{ width: 130 }}>Tipe</th><th>Kunci</th><th style={{ width: 60 }}>Bobot</th></tr></thead>
              <tbody>
                {soal.map((s, i) => (
                  <tr key={s.id}>
                    <td style={{ textAlign: 'center' }}>{i + 1}</td>
                    <td>{s.tipe === 'pg' ? 'PG' : s.tipe === 'mcma' ? 'PG Kompleks' : 'Kategori'}</td>
                    <td><b>{kunciTeks(s)}</b></td>
                    <td style={{ textAlign: 'center' }}>{s.bobot}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ marginTop: 8, fontSize: '0.9em' }}>Total bobot: {soal.reduce((a, s) => a + Number(s.bobot), 0)}. Nilai = skor ÷ total bobot × 100.</p>
          </div>
        )}
      </div>
    </div>
  );
}
