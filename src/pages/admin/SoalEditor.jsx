import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Upload, Download, FileSpreadsheet, Pencil, Trash2, ArrowUp, ArrowDown, Check, X, ListChecks } from 'lucide-react';
import { supabase, q } from '../../lib/supabase';
import { Modal, Empty, Spinner, Field, useToast, useConfirm } from '../../components/ui';
import RichEditor from '../../components/RichEditor';
import RichText from '../../components/RichText';
import { LETTERS, TIPE_LABEL } from '../../lib/util';
import { readSheet, downloadSheet } from '../../lib/excel';
import { rowToSoal, soalToRow, TEMPLATE_SOAL } from '../../lib/importSoal';

const MAX_OPSI = 5; // pilihan A sampai E
const LABEL_PRESETS = [['Benar', 'Salah'], ['Sesuai', 'Tidak Sesuai'], ['Ya', 'Tidak'], ['Fakta', 'Opini']];

const blank = (tipe = 'pg') => ({
  tipe,
  pertanyaan: '',
  opsi: tipe === 'kategori'
    ? [1, 2, 3].map((i) => ({ id: String(i), teks: '' }))
    : LETTERS.slice(0, 5).map((id) => ({ id, teks: '' })),
  kunci: tipe === 'pg' ? '' : tipe === 'mcma' ? [] : {},
  label_kategori: ['Benar', 'Salah'],
  bobot: 1,
});

function SoalForm({ value, onChange }) {
  const s = value;
  const set = (patch) => onChange({ ...s, ...patch });

  const changeTipe = (tipe) => {
    if (tipe === s.tipe) return;
    const b = blank(tipe);
    // pertahankan teks opsi bila pindah antar PG <-> MCMA
    if (tipe !== 'kategori' && s.tipe !== 'kategori') b.opsi = s.opsi;
    onChange({ ...b, pertanyaan: s.pertanyaan, bobot: s.bobot });
  };

  const setOpsi = (i, teks) => set({ opsi: s.opsi.map((o, j) => (j === i ? { ...o, teks } : o)) });

  const addOpsi = () => {
    if (s.tipe !== 'kategori' && s.opsi.length >= MAX_OPSI) return;
    const id = s.tipe === 'kategori' ? String(Math.max(0, ...s.opsi.map((o) => +o.id)) + 1) : LETTERS[s.opsi.length];
    set({ opsi: [...s.opsi, { id, teks: '' }] });
  };

  const removeOpsi = (i) => {
    const o = s.opsi[i];
    const opsi = s.opsi.filter((_, j) => j !== i);
    if (s.tipe === 'kategori') {
      const k = { ...s.kunci }; delete k[o.id];
      return set({ opsi, kunci: k });
    }
    // PG/MCMA: susun ulang huruf agar tetap A, B, C...
    const remap = Object.fromEntries(opsi.map((x, j) => [x.id, LETTERS[j]]));
    const ops = opsi.map((x, j) => ({ ...x, id: LETTERS[j] }));
    const kunci = s.tipe === 'pg' ? remap[s.kunci] || '' : (s.kunci || []).filter((k) => remap[k]).map((k) => remap[k]);
    set({ opsi: ops, kunci });
  };

  const toggleKunci = (id) => {
    if (s.tipe === 'pg') return set({ kunci: id });
    const arr = s.kunci || [];
    set({ kunci: arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id].sort() });
  };

  return (
    <div>
      <div className="row mb">
        {Object.entries(TIPE_LABEL).map(([k, l]) => (
          <button key={k} type="button" className={`btn sm ${s.tipe === k ? '' : 'ghost'}`} onClick={() => changeTipe(k)}>{l}</button>
        ))}
      </div>
      <Field label="Pertanyaan / Stimulus">
        <RichEditor value={s.pertanyaan} onChange={(v) => set({ pertanyaan: v })} rows={5} placeholder="Tulis soal. Gunakan tombol Gambar & Rumus, atau tempel (Ctrl+V) gambar langsung." />
      </Field>

      {s.tipe === 'kategori' && (
        <Field label="Label kategori">
          <div className="row">
            {LABEL_PRESETS.map((p) => (
              <button key={p.join()} type="button" className={`btn sm ${s.label_kategori.join() === p.join() ? 'mint' : 'ghost'}`}
                onClick={() => {
                  const old = s.label_kategori;
                  const kunci = Object.fromEntries(Object.entries(s.kunci || {}).map(([k, v]) => [k, p[old.indexOf(v)] ?? v]));
                  set({ label_kategori: p, kunci });
                }}>{p.join(' / ')}</button>
            ))}
          </div>
        </Field>
      )}

      <label className="label">
        {s.tipe === 'kategori' ? 'Pernyataan & kunci' : s.tipe === 'mcma' ? 'Opsi jawaban A–E (centang SEMUA jawaban benar)' : 'Opsi jawaban A–E (pilih 1 kunci)'}
      </label>
      {s.opsi.map((o, i) => (
        <div key={o.id + i} className="clay-sm mb" style={{ padding: 12 }}>
          <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
            {s.tipe !== 'kategori' ? (
              <button type="button" title="Tandai sebagai kunci"
                className={`opt-key ${s.tipe === 'mcma' ? 'sq' : ''}`}
                style={{ border: 0, cursor: 'pointer', ...(s.tipe === 'pg' ? s.kunci === o.id : (s.kunci || []).includes(o.id)) ? { background: 'var(--mint)', color: '#fff' } : {} }}
                onClick={() => toggleKunci(o.id)}>{o.id}</button>
            ) : (
              <div className="opt-key">{i + 1}</div>
            )}
            <div className="grow" style={{ minWidth: 0 }}>
              <RichEditor compact rows={2} value={o.teks} onChange={(v) => setOpsi(i, v)} placeholder={s.tipe === 'kategori' ? 'Pernyataan...' : `Opsi ${o.id}`} />
              {s.tipe === 'kategori' && (
                <div className="row mt" style={{ gap: 8 }}>
                  <span className="small muted bold">Kunci:</span>
                  {s.label_kategori.map((l) => (
                    <button key={l} type="button" className={`kat-pick ${s.kunci?.[o.id] === l ? 'on' : ''}`}
                      onClick={() => set({ kunci: { ...s.kunci, [o.id]: l } })}>{l}</button>
                  ))}
                </div>
              )}
            </div>
            <button type="button" className="btn ghost icon sm" onClick={() => removeOpsi(i)} disabled={s.opsi.length <= 2}><X size={15} /></button>
          </div>
        </div>
      ))}
      <div className="row between">
        <button type="button" className="btn ghost sm" onClick={addOpsi} disabled={s.tipe !== 'kategori' && s.opsi.length >= MAX_OPSI}><Plus size={15} /> Tambah {s.tipe === 'kategori' ? 'pernyataan' : 'opsi'}</button>
        <div className="row" style={{ flexWrap: 'nowrap' }}>
          <span className="small bold muted">Bobot</span>
          <input className="input" type="number" min="0.5" step="0.5" style={{ width: 90 }} value={s.bobot} onChange={(e) => set({ bobot: e.target.value })} />
        </div>
      </div>
    </div>
  );
}

function validate(s) {
  if (!s.pertanyaan.trim()) return 'Pertanyaan wajib diisi';
  if (s.opsi.some((o) => !o.teks.trim())) return 'Semua opsi/pernyataan wajib diisi (hapus yang tidak dipakai)';
  if (s.tipe === 'pg' && !s.kunci) return 'Pilih kunci jawaban';
  if (s.tipe === 'mcma' && (s.kunci || []).length < 1) return 'Centang minimal 1 kunci jawaban';
  if (s.tipe === 'kategori' && s.opsi.some((o) => !s.kunci?.[o.id])) return 'Tentukan kunci untuk setiap pernyataan';
  return null;
}

export function SoalCard({ s, no, children }) {
  return (
    <div className="clay mb">
      <div className="row between mb">
        <div className="row">
          <span className="opt-key" style={{ background: 'var(--primary)', color: '#fff', boxShadow: 'none' }}>{no}</span>
          <span className="badge">{TIPE_LABEL[s.tipe]}</span>
          <span className="badge gray">Bobot {s.bobot}</span>
        </div>
        <div className="row" style={{ gap: 6 }}>{children}</div>
      </div>
      <RichText value={s.pertanyaan} />
      <div className="mt">
        {s.tipe === 'kategori' ? (
          <table className="kat-table">
            <tbody>
              {s.opsi.map((o, i) => (
                <tr key={o.id}><td style={{ width: 30 }} className="bold">{i + 1}.</td><td><RichText value={o.teks} /></td>
                  <td style={{ width: 140 }}><span className="badge mint"><Check size={12} /> {s.kunci?.[o.id]}</span></td></tr>
              ))}
            </tbody>
          </table>
        ) : (
          s.opsi.map((o) => {
            const benar = s.tipe === 'pg' ? s.kunci === o.id : (s.kunci || []).includes(o.id);
            return (
              <div key={o.id} className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap', marginBottom: 6 }}>
                <span className={`badge ${benar ? 'mint' : 'gray'}`} style={{ minWidth: 30, justifyContent: 'center' }}>{o.id}</span>
                <RichText value={o.teks} />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function SoalEditor() {
  const { id } = useParams();
  const toast = useToast();
  const confirm = useConfirm();
  const fileRef = useRef(null);
  const [bank, setBank] = useState(null);
  const [rows, setRows] = useState(null);
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);

  const load = async () => {
    try {
      const [b, s] = await Promise.all([
        q(supabase.from('bank_soal').select('*, mapel(nama)').eq('id', id).single()),
        q(supabase.from('soal').select('*').eq('bank_id', id).order('urutan').order('created_at')),
      ]);
      setBank(b); setRows(s);
    } catch (e) { toast.err(e); setRows([]); }
  };
  useEffect(() => { load(); }, [id]);

  const save = async () => {
    const err = validate(edit);
    if (err) return toast.err(err);
    const p = {
      bank_id: id, tipe: edit.tipe, pertanyaan: edit.pertanyaan, opsi: edit.opsi,
      kunci: edit.kunci, label_kategori: edit.label_kategori, bobot: Number(edit.bobot) || 1,
    };
    try {
      if (edit.id) await q(supabase.from('soal').update(p).eq('id', edit.id));
      else await q(supabase.from('soal').insert({ ...p, urutan: (rows?.length || 0) + 1 }));
      toast.ok('Soal tersimpan'); setEdit(null); load();
    } catch (e) { toast.err(e); }
  };

  const del = async (s) => {
    if (!(await confirm('Hapus soal ini?'))) return;
    try { await q(supabase.from('soal').delete().eq('id', s.id)); load(); } catch (e) { toast.err(e); }
  };

  const move = async (i, d) => {
    const arr = [...rows];
    const j = i + d;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    setRows(arr);
    try {
      await Promise.all(arr.map((s, k) => supabase.from('soal').update({ urutan: k + 1 }).eq('id', s.id)));
    } catch (e) { toast.err(e); }
  };

  const parseFile = async (file) => {
    if (!file) return;
    try {
      const data = (await readSheet(file)).filter((r) => Object.values(r).some(Boolean));
      const ok = []; const errs = [];
      data.forEach((r, i) => { try { ok.push(rowToSoal(r, i)); } catch (e) { errs.push(e.message); } });
      setPreview({ ok, errs });
    } catch (e) { toast.err(e); }
  };

  const doImport = async () => {
    setBusy(true);
    try {
      const base = rows.length;
      const payload = preview.ok.map((s, i) => ({ ...s, bank_id: id, urutan: base + i + 1 }));
      for (let i = 0; i < payload.length; i += 200) await q(supabase.from('soal').insert(payload.slice(i, i + 200)));
      toast.ok(`${payload.length} soal berhasil diimpor`);
      setPreview(null); load();
    } catch (e) { toast.err(e); } finally { setBusy(false); }
  };

  const template = () => downloadSheet('template_soal.xlsx', TEMPLATE_SOAL, 'Soal', [10, 50, 20, 18, 18, 18, 18, 18, 14, 18, 7]);
  const exportXls = () => downloadSheet(`soal_${bank?.nama || 'bank'}.xlsx`, rows.map(soalToRow), 'Soal');

  return (
    <div>
      <div className="page-head">
        <div className="row">
          <Link to="/admin/bank" className="btn ghost icon"><ArrowLeft size={18} /></Link>
          <div>
            <h1>{bank?.nama || 'Bank Soal'}</h1>
            <div className="small muted">{bank?.mapel?.nama} · {rows?.length ?? 0} soal · total bobot {rows?.reduce((a, s) => a + Number(s.bobot), 0) ?? 0}</div>
          </div>
        </div>
        <div className="row">
          <button className="btn ghost sm" onClick={template}><FileSpreadsheet size={16} /> Template</button>
          <button className="btn sky sm" onClick={() => fileRef.current.click()}><Upload size={16} /> Import Excel</button>
          <button className="btn ghost sm" onClick={exportXls} disabled={!rows?.length}><Download size={16} /> Export</button>
          <button className="btn sm" onClick={() => setEdit(blank())}><Plus size={16} /> Tambah Soal</button>
          <input ref={fileRef} type="file" hidden accept=".xlsx,.xls,.csv" onChange={(e) => { parseFile(e.target.files[0]); e.target.value = ''; }} />
        </div>
      </div>

      {!rows ? <Spinner /> : rows.length === 0 ? (
        <div className="clay"><Empty text="Belum ada soal" icon={ListChecks}>
          <p className="small">Tambah soal manual atau impor dari Excel (unduh template terlebih dahulu).</p>
        </Empty></div>
      ) : rows.map((s, i) => (
        <SoalCard key={s.id} s={s} no={i + 1}>
          <button className="btn ghost icon sm" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp size={15} /></button>
          <button className="btn ghost icon sm" onClick={() => move(i, 1)} disabled={i === rows.length - 1}><ArrowDown size={15} /></button>
          <button className="btn ghost icon sm" onClick={() => setEdit(JSON.parse(JSON.stringify(s)))}><Pencil size={15} /></button>
          <button className="btn red icon sm" onClick={() => del(s)}><Trash2 size={15} /></button>
        </SoalCard>
      ))}

      {edit && (
        <Modal size="lg" title={edit.id ? 'Edit Soal' : 'Tambah Soal'} onClose={() => setEdit(null)}
          footer={<><button className="btn ghost" onClick={() => setEdit(null)}>Batal</button><button className="btn" onClick={save}>Simpan Soal</button></>}>
          <SoalForm value={edit} onChange={setEdit} />
        </Modal>
      )}

      {preview && (
        <Modal size="lg" title="Pratinjau Import" onClose={() => setPreview(null)}
          footer={<><button className="btn ghost" onClick={() => setPreview(null)}>Batal</button>
            <button className="btn mint" disabled={busy || !preview.ok.length} onClick={doImport}>Import {preview.ok.length} soal</button></>}>
          {preview.errs.length > 0 && (
            <div className="clay-in mb">
              <div className="bold" style={{ color: 'var(--red)' }}>{preview.errs.length} baris dilewati:</div>
              <ul className="small" style={{ margin: '6px 0 0', paddingLeft: 18 }}>{preview.errs.slice(0, 15).map((e) => <li key={e}>{e}</li>)}</ul>
            </div>
          )}
          <div style={{ maxHeight: '55vh', overflowY: 'auto', padding: 6 }}>
            {preview.ok.map((s, i) => <SoalCard key={i} s={s} no={i + 1} />)}
          </div>
        </Modal>
      )}
    </div>
  );
}
