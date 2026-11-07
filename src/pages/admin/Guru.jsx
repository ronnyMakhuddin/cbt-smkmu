import { useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, KeyRound, UserCog } from 'lucide-react';
import { supabase, q, rpc } from '../../lib/supabase';
import { Modal, Empty, Spinner, Field, useToast, useConfirm } from '../../components/ui';
import { useProfil } from '../../components/AdminLayout';
import { randomPassword } from '../../lib/util';

export default function Guru() {
  const toast = useToast();
  const confirm = useConfirm();
  const me = useProfil();
  const [rows, setRows] = useState(null);
  const [mapel, setMapel] = useState([]);
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [p, m] = await Promise.all([
        q(supabase.from('pengguna').select('*').order('role').order('nama')),
        q(supabase.from('mapel').select('*').order('nama')),
      ]);
      setRows(p); setMapel(m);
    } catch (e) { toast.err(e); setRows([]); }
  };
  useEffect(() => { load(); }, []);

  const mapelMap = useMemo(() => Object.fromEntries(mapel.map((m) => [m.id, m.nama])), [mapel]);

  const save = async () => {
    setBusy(true);
    try {
      await rpc('admin_simpan_pengguna', {
        p_id: edit.id || null, p_nama: edit.nama || '', p_email: edit.email || '',
        p_password: edit.password || '', p_role: edit.role || 'guru', p_mapel: edit.mapel_ids || [],
      });
      toast.ok(edit.id ? 'Akun diperbarui' : `Akun dibuat. Password: ${edit.password}`);
      setEdit(null); load();
    } catch (e) { toast.err(e); } finally { setBusy(false); }
  };

  const del = async (r) => {
    if (!(await confirm(`Hapus akun ${r.nama}? Bank soal & ujian buatannya tetap tersimpan.`))) return;
    try { await rpc('admin_hapus_pengguna', { p_id: r.id }); toast.ok('Akun dihapus'); load(); } catch (e) { toast.err(e); }
  };

  const toggleMapel = (id) => setEdit((e) => ({ ...e, mapel_ids: e.mapel_ids.includes(id) ? e.mapel_ids.filter((x) => x !== id) : [...e.mapel_ids, id] }));

  return (
    <div>
      <div className="page-head">
        <h1>Guru & Admin</h1>
        <button className="btn" onClick={() => setEdit({ role: 'guru', mapel_ids: [], password: randomPassword(8) })}><Plus size={17} /> Tambah Akun</button>
      </div>

      <div className="clay mb small muted">
        <b>Guru</b> dapat membuat bank soal & ujian, mengelola soal pada mapel yang diampu, serta memantau dan menilai ujiannya sendiri.
        <b> Admin</b> memiliki akses penuh termasuk data siswa, kartu ujian, pengaturan sekolah, dan akun.
        Guru login di halaman yang sama dengan admin (<code>/admin</code>) memakai email & password di bawah.
      </div>

      <div className="clay">
        {!rows ? <Spinner /> : rows.length === 0 ? <Empty text="Belum ada akun" icon={UserCog} /> : (
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>Nama</th><th>Email (login)</th><th>Peran</th><th>Mapel diampu</th><th /></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="bold">{r.nama} {r.id === me?.id && <span className="badge gray">Anda</span>}</td>
                    <td>{r.email}</td>
                    <td><span className={`badge ${r.role === 'admin' ? '' : 'mint'}`}>{r.role === 'admin' ? 'Admin' : 'Guru'}</span></td>
                    <td>
                      <div className="row" style={{ gap: 5 }}>
                        {r.role === 'admin' ? <span className="small muted">Semua</span>
                          : r.mapel_ids.length ? r.mapel_ids.map((m) => <span key={m} className="badge sky">{mapelMap[m] || '?'}</span>)
                          : <span className="small muted">-</span>}
                      </div>
                    </td>
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                      <button className="btn ghost icon sm" title="Edit / reset password" onClick={() => setEdit({ ...r, password: '' })}><Pencil size={15} /></button>{' '}
                      {r.id !== me?.id && <button className="btn red icon sm" title="Hapus" onClick={() => del(r)}><Trash2 size={15} /></button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {edit && (
        <Modal title={edit.id ? 'Edit Akun' : 'Tambah Akun Guru / Admin'} onClose={() => setEdit(null)}
          footer={<><button className="btn ghost" onClick={() => setEdit(null)}>Batal</button><button className="btn" disabled={busy} onClick={save}>Simpan</button></>}>
          <div className="grid g2" style={{ gap: 0, columnGap: 14 }}>
            <Field label="Nama Lengkap"><input className="input" value={edit.nama || ''} onChange={(e) => setEdit({ ...edit, nama: e.target.value })} /></Field>
            <Field label="Email (untuk login)"><input className="input" type="email" value={edit.email || ''} placeholder="guru@smk.sch.id" onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
            <Field label={edit.id ? 'Password baru' : 'Password'} hint={edit.id ? 'Kosongkan bila tidak diganti' : 'Minimal 6 karakter, catat & berikan ke guru'}>
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <input className="input" value={edit.password || ''} onChange={(e) => setEdit({ ...edit, password: e.target.value })} />
                <button type="button" className="btn ghost icon" onClick={() => setEdit({ ...edit, password: randomPassword(8) })}><KeyRound size={16} /></button>
              </div>
            </Field>
            <Field label="Peran">
              <select className="input" value={edit.role} disabled={edit.id === me?.id} onChange={(e) => setEdit({ ...edit, role: e.target.value })}>
                <option value="guru">Guru</option>
                <option value="admin">Admin</option>
              </select>
            </Field>
          </div>
          {edit.role === 'guru' && (
            <Field label="Mapel yang diampu" hint="Guru bisa mengelola semua bank soal pada mapel ini, juga bank soal buatannya sendiri">
              <div className="row" style={{ gap: 8 }}>
                {mapel.length === 0 && <span className="small muted">Belum ada mapel, tambahkan di menu Kelas & Mapel</span>}
                {mapel.map((m) => (
                  <button type="button" key={m.id} className={`btn sm ${edit.mapel_ids.includes(m.id) ? 'mint' : 'ghost'}`} onClick={() => toggleMapel(m.id)}>{m.nama}</button>
                ))}
              </div>
            </Field>
          )}
        </Modal>
      )}
    </div>
  );
}
