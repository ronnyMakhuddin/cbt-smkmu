import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, School, BookMarked } from 'lucide-react';
import { supabase, q } from '../../lib/supabase';
import { Modal, Empty, Spinner, Field, useToast, useConfirm } from '../../components/ui';

function CrudList({ table, title, icon, fields, order }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState(null);
  const [edit, setEdit] = useState(null);

  const load = async () => {
    try {
      setRows(await q(supabase.from(table).select('*').order(order)));
    } catch (e) { toast.err(e); setRows([]); }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      const payload = Object.fromEntries(fields.map((f) => [f.key, (edit[f.key] || '').trim() || null]));
      if (!payload[fields[0].key]) return toast.err(`${fields[0].label} wajib diisi`);
      if (edit.id) await q(supabase.from(table).update(payload).eq('id', edit.id));
      else await q(supabase.from(table).insert(payload));
      toast.ok('Tersimpan');
      setEdit(null);
      load();
    } catch (e) { toast.err(e); }
  };

  const del = async (r) => {
    if (!(await confirm(`Hapus "${r[fields[0].key]}"?`))) return;
    try { await q(supabase.from(table).delete().eq('id', r.id)); toast.ok('Dihapus'); load(); } catch (e) { toast.err(e); }
  };

  const Icon = icon;
  return (
    <div className="clay">
      <div className="row between mb">
        <h2 className="row"><Icon size={22} color="#6c63ff" /> {title}</h2>
        <button className="btn sm" onClick={() => setEdit({})}><Plus size={16} /> Tambah</button>
      </div>
      {!rows ? <Spinner /> : rows.length === 0 ? <Empty /> : (
        <div className="table-wrap">
          <table className="t">
            <thead><tr>{fields.map((f) => <th key={f.key}>{f.label}</th>)}<th /></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  {fields.map((f, i) => <td key={f.key} className={i === 0 ? 'bold' : ''}>{r[f.key] || '-'}</td>)}
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="btn ghost icon sm" onClick={() => setEdit(r)}><Pencil size={15} /></button>{' '}
                    <button className="btn red icon sm" onClick={() => del(r)}><Trash2 size={15} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {edit && (
        <Modal title={`${edit.id ? 'Edit' : 'Tambah'} ${title}`} onClose={() => setEdit(null)}
          footer={<><button className="btn ghost" onClick={() => setEdit(null)}>Batal</button><button className="btn" onClick={save}>Simpan</button></>}>
          {fields.map((f) => (
            <Field key={f.key} label={f.label}>
              <input className="input" value={edit[f.key] || ''} placeholder={f.ph} onChange={(e) => setEdit({ ...edit, [f.key]: e.target.value })} />
            </Field>
          ))}
        </Modal>
      )}
    </div>
  );
}

export default function DataMaster() {
  return (
    <div>
      <div className="page-head"><h1>Kelas & Mata Pelajaran</h1></div>
      <div className="grid g2">
        <CrudList table="kelas" title="Kelas" icon={School} order="nama"
          fields={[{ key: 'nama', label: 'Nama Kelas', ph: 'X TKJ 1' }, { key: 'jurusan', label: 'Jurusan', ph: 'Teknik Komputer & Jaringan' }]} />
        <CrudList table="mapel" title="Mata Pelajaran" icon={BookMarked} order="nama"
          fields={[{ key: 'nama', label: 'Nama Mapel', ph: 'Matematika' }, { key: 'kode', label: 'Kode', ph: 'MTK' }]} />
      </div>
    </div>
  );
}
