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
  const [kelas, setKelas] = useState([]);
  const [ajar, setAjar] = useState([]);
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [p, m, k, a] = await Promise.all([
        q(supabase.from('pengguna').select('*').order('role').order('nama')),
        q(supabase.from('mapel').select('*').order('nama')),
        q(supabase.from('kelas').select('*').order('nama')),
        q(supabase.from('pengajaran').select('*')),
      ]);
      setRows(p); setMapel(m); setKelas(k); setAjar(a);
    } catch (e) { toast.err(e); setRows([]); }
  };
  useEffect(() => { load(); }, []);

  const mapelMap = useMemo(() => Object.fromEntries(mapel.map((m) => [m.id, m.nama])), [mapel]);
  const kelasMap = useMemo(() => Object.fromEntries(kelas.map((k) => [k.id, k.nama])), [kelas]);
  // ringkasan tugas mengajar per guru: { guruId: { mapelId: [kelasId] } }
  const ajarMap = useMemo(() => {
    const o = {};
    ajar.forEach((a) => { ((o[a.guru_id] ||= {})[a.mapel_id] ||= []).push(a.kelas_id); });
    return o;
  }, [ajar]);
  const keyOf = (m, k) => `${m}|${k}`;
  const openEdit = (r) => setEdit({
    ...r, password: '',
    ajar: ajar.filter((a) => a.guru_id === r.id).map((a) => keyOf(a.mapel_id, a.kelas_id)),
  });
  const toggleAjar = (m, k) => setEdit((e) => {
    const key = keyOf(m, k);
    return { ...e, ajar: e.ajar.includes(key) ? e.ajar.filter((x) => x !== key) : [...e.ajar, key] };
  });
  const toggleSemuaKelas = (m) => setEdit((e) => {
    const all = kelas.map((k) => keyOf(m, k.id));
    const full = all.every((x) => e.ajar.includes(x));
    return { ...e, ajar: full ? e.ajar.filter((x) => !all.includes(x)) : [...new Set([...e.ajar, ...all])] };
  });

  const save = async () => {
    setBusy(true);
    try {
      await rpc('admin_simpan_pengguna', {
        p_id: edit.id || null, p_nama: edit.nama || '', p_email: edit.email || '',
        p_password: edit.password || '', p_role: edit.role || 'guru',
        p_ajar: (edit.ajar || []).map((x) => { const [mapel_id, kelas_id] = x.split('|'); return { mapel_id, kelas_id }; }),
      });
      toast.ok(edit.id ? 'Akun diperbarui' : `Akun dibuat. Password: ${edit.password}`);
      setEdit(null); load();
    } catch (e) { toast.err(e); } finally { setBusy(false); }
  };

  const del = async (r) => {
    if (!(await confirm(`Hapus akun ${r.nama}? Bank soal & ujian buatannya tetap tersimpan.`))) return;
    try { await rpc('admin_hapus_pengguna', { p_id: r.id }); toast.ok('Akun dihapus'); load(); } catch (e) { toast.err(e); }
  };


  return (
    <div>
      <div className="page-head">
        <h1>Guru & Admin</h1>
        <button className="btn" onClick={() => setEdit({ role: 'guru', ajar: [], password: randomPassword(8) })}><Plus size={17} /> Tambah Akun</button>
      </div>

      <div className="clay mb small muted">
        <b>Guru</b> dapat membuat bank soal & ujian untuk mapel dan kelas yang diajarnya (atur di <b>Tugas Mengajar</b>), serta memantau dan menilai ujiannya sendiri.
        <b> Admin</b> memiliki akses penuh termasuk data siswa, kartu ujian, pengaturan sekolah, dan akun.
        Guru login di halaman yang sama dengan admin (<code>/admin</code>) memakai email & password di bawah.
      </div>

      <div className="clay">
        {!rows ? <Spinner /> : rows.length === 0 ? <Empty text="Belum ada akun" icon={UserCog} /> : (
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>Nama</th><th>Email (login)</th><th>Peran</th><th>Tugas Mengajar</th><th /></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="bold">{r.nama} {r.id === me?.id && <span className="badge gray">Anda</span>}</td>
                    <td>{r.email}</td>
                    <td><span className={`badge ${r.role === 'admin' ? '' : 'mint'}`}>{r.role === 'admin' ? 'Admin' : 'Guru'}</span></td>
                    <td>
                      {r.role === 'admin' ? <span className="small muted">Semua</span>
                        : ajarMap[r.id] ? (
                          <div className="col" style={{ gap: 4 }}>
                            {Object.entries(ajarMap[r.id]).map(([m, ks]) => (
                              <div key={m} className="small"><span className="badge mint">{mapelMap[m] || '?'}</span>{' '}
                                <span className="muted">{ks.map((k) => kelasMap[k]).filter(Boolean).sort().join(', ')}</span></div>
                            ))}
                          </div>
                        ) : <span className="small muted">Belum diatur</span>}
                    </td>
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                      <button className="btn ghost icon sm" title="Edit / reset password" onClick={() => openEdit(r)}><Pencil size={15} /></button>{' '}
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
            <Field label="Tugas Mengajar (mapel → kelas)" hint="Guru hanya bisa membuat ujian mapel tersebut untuk kelas yang dicentang">
              {(mapel.length === 0 || kelas.length === 0) && <span className="small muted">Tambahkan mapel dan kelas dulu di menu Kelas & Mapel</span>}
              <div className="col" style={{ gap: 10, maxHeight: '45vh', overflowY: 'auto', padding: 4 }}>
                {mapel.map((m) => {
                  const n = kelas.filter((k) => edit.ajar.includes(keyOf(m.id, k.id))).length;
                  return (
                    <div key={m.id} className="clay-sm" style={{ padding: 12 }}>
                      <div className="row between mb" style={{ marginBottom: 8 }}>
                        <span className="bold">{m.nama} {n > 0 && <span className="badge mint">{n} kelas</span>}</span>
                        <button type="button" className="tbtn" onClick={() => toggleSemuaKelas(m.id)}>{n === kelas.length ? 'Kosongkan' : 'Semua kelas'}</button>
                      </div>
                      <div className="row" style={{ gap: 6 }}>
                        {kelas.map((k) => (
                          <button type="button" key={k.id} className={`btn sm ${edit.ajar.includes(keyOf(m.id, k.id)) ? 'mint' : 'ghost'}`} onClick={() => toggleAjar(m.id, k.id)}>{k.nama}</button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Field>
          )}
        </Modal>
      )}
    </div>
  );
}
