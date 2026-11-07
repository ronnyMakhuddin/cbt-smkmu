import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, BookOpen, ArrowRight } from 'lucide-react';
import { supabase, q } from '../../lib/supabase';
import { Modal, Empty, Spinner, Field, useToast, useConfirm } from '../../components/ui';

export default function BankSoal() {
  const toast = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState(null);
  const [mapel, setMapel] = useState([]);
  const [edit, setEdit] = useState(null);

  const load = async () => {
    try {
      const [b, m] = await Promise.all([
        q(supabase.from('bank_soal').select('*, mapel(nama), soal(count)').order('created_at', { ascending: false })),
        q(supabase.from('mapel').select('*').order('nama')),
      ]);
      setRows(b); setMapel(m);
    } catch (e) { toast.err(e); setRows([]); }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    const p = { nama: (edit.nama || '').trim(), mapel_id: edit.mapel_id || null, keterangan: edit.keterangan || null };
    if (!p.nama) return toast.err('Nama bank soal wajib diisi');
    try {
      if (edit.id) await q(supabase.from('bank_soal').update(p).eq('id', edit.id));
      else await q(supabase.from('bank_soal').insert(p));
      toast.ok('Tersimpan'); setEdit(null); load();
    } catch (e) { toast.err(e); }
  };

  const del = async (b) => {
    if (!(await confirm(`Hapus bank soal "${b.nama}" beserta semua soalnya?`))) return;
    try { await q(supabase.from('bank_soal').delete().eq('id', b.id)); toast.ok('Dihapus'); load(); } catch (e) { toast.err(e); }
  };

  const tints = ['tint-primary', 'tint-pink', 'tint-sky', 'tint-mint', 'tint-amber'];
  return (
    <div>
      <div className="page-head">
        <h1>Bank Soal</h1>
        <button className="btn" onClick={() => setEdit({})}><Plus size={17} /> Bank Soal Baru</button>
      </div>
      {!rows ? <Spinner /> : rows.length === 0 ? (
        <div className="clay"><Empty text="Belum ada bank soal" icon={BookOpen}>
          {mapel.length === 0 && <p className="small">Tambahkan mata pelajaran dulu di menu Kelas & Mapel.</p>}
        </Empty></div>
      ) : (
        <div className="grid g3">
          {rows.map((b, i) => (
            <div key={b.id} className="clay col">
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <div className={`stat-ico ${tints[i % tints.length]}`}><BookOpen size={24} /></div>
                <div style={{ minWidth: 0 }}>
                  <h3>{b.nama}</h3>
                  <div className="small muted">{b.mapel?.nama || 'Tanpa mapel'}</div>
                </div>
              </div>
              {b.keterangan && <p className="small muted">{b.keterangan}</p>}
              <div className="row between">
                <span className="badge">{b.soal?.[0]?.count ?? 0} soal</span>
                <div className="row" style={{ gap: 6 }}>
                  <button className="btn ghost icon sm" onClick={() => setEdit(b)}><Pencil size={15} /></button>
                  <button className="btn red icon sm" onClick={() => del(b)}><Trash2 size={15} /></button>
                  <Link className="btn sm" to={`/admin/bank/${b.id}`}>Kelola <ArrowRight size={15} /></Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {edit && (
        <Modal title={edit.id ? 'Edit Bank Soal' : 'Bank Soal Baru'} onClose={() => setEdit(null)}
          footer={<><button className="btn ghost" onClick={() => setEdit(null)}>Batal</button><button className="btn" onClick={save}>Simpan</button></>}>
          <Field label="Nama Bank Soal"><input className="input" value={edit.nama || ''} placeholder="PAS Matematika X Ganjil" onChange={(e) => setEdit({ ...edit, nama: e.target.value })} /></Field>
          <Field label="Mata Pelajaran">
            <select className="input" value={edit.mapel_id || ''} onChange={(e) => setEdit({ ...edit, mapel_id: e.target.value })}>
              <option value="">- pilih -</option>
              {mapel.map((m) => <option key={m.id} value={m.id}>{m.nama}</option>)}
            </select>
          </Field>
          <Field label="Keterangan"><input className="input" value={edit.keterangan || ''} onChange={(e) => setEdit({ ...edit, keterangan: e.target.value })} /></Field>
        </Modal>
      )}
    </div>
  );
}
