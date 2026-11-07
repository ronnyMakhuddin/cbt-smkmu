import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Upload, Download, Pencil, Trash2, KeyRound, Search, RotateCcw, FileSpreadsheet } from 'lucide-react';
import { supabase, q, fetchAll } from '../../lib/supabase';
import { Modal, Empty, Spinner, Field, useToast, useConfirm } from '../../components/ui';
import { readSheet, downloadSheet } from '../../lib/excel';
import { randomPassword, fmtDate } from '../../lib/util';

export default function Siswa() {
  const toast = useToast();
  const confirm = useConfirm();
  const fileRef = useRef(null);
  const [rows, setRows] = useState(null);
  const [kelas, setKelas] = useState([]);
  const [fKelas, setFKelas] = useState('');
  const [search, setSearch] = useState('');
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const [s, k] = await Promise.all([
        fetchAll(() => supabase.from('siswa').select('*').order('nama')),
        q(supabase.from('kelas').select('*').order('nama')),
      ]);
      setRows(s);
      setKelas(k);
    } catch (e) { toast.err(e); setRows([]); }
  };
  useEffect(() => { load(); }, []);

  const kelasMap = useMemo(() => Object.fromEntries(kelas.map((k) => [k.id, k.nama])), [kelas]);
  const filtered = useMemo(() => (rows || []).filter((r) =>
    (!fKelas || r.kelas_id === fKelas) &&
    (!search || `${r.nis} ${r.nama}`.toLowerCase().includes(search.toLowerCase()))), [rows, fKelas, search]);

  const save = async () => {
    const p = {
      nis: (edit.nis || '').trim(), nama: (edit.nama || '').trim(), kelas_id: edit.kelas_id || null,
      jk: edit.jk || null, password: (edit.password || '').trim() || randomPassword(),
      ruang: edit.ruang || null, sesi: edit.sesi || null,
    };
    if (!p.nis || !p.nama) return toast.err('NIS dan nama wajib diisi');
    try {
      if (edit.id) await q(supabase.from('siswa').update(p).eq('id', edit.id));
      else await q(supabase.from('siswa').insert(p));
      toast.ok('Data siswa tersimpan'); setEdit(null); load();
    } catch (e) { toast.err(e); }
  };

  const del = async (r) => {
    if (!(await confirm(`Hapus siswa ${r.nama}? Semua hasil ujiannya ikut terhapus.`))) return;
    try { await q(supabase.from('siswa').delete().eq('id', r.id)); toast.ok('Dihapus'); load(); } catch (e) { toast.err(e); }
  };

  const resetLogin = async (r) => {
    try { await q(supabase.from('siswa').update({ session_token: null }).eq('id', r.id)); toast.ok(`Login ${r.nama} direset`); load(); } catch (e) { toast.err(e); }
  };

  const genPasswords = async () => {
    const target = filtered;
    if (!target.length) return;
    if (!(await confirm(`Buat ulang password untuk ${target.length} siswa (sesuai filter)?`, { danger: false }))) return;
    setBusy(true);
    try {
      const upd = target.map((r) => ({ ...r, password: randomPassword() }));
      for (let i = 0; i < upd.length; i += 500) await q(supabase.from('siswa').upsert(upd.slice(i, i + 500)));
      toast.ok('Password baru dibuat'); load();
    } catch (e) { toast.err(e); } finally { setBusy(false); }
  };

  const template = () => downloadSheet('template_siswa.xlsx', [
    { nis: '2025001', nama: 'Ahmad Fauzi', kelas: 'X TKJ 1', jk: 'L', password: '', ruang: 'R1', sesi: '1' },
    { nis: '2025002', nama: 'Siti Aminah', kelas: 'X AKL 1', jk: 'P', password: 'abc123', ruang: 'R2', sesi: '1' },
  ], 'Siswa', [12, 28, 12, 5, 12, 8, 6]);

  const importFile = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const data = await readSheet(file);
      const valid = data.filter((r) => r.nis && r.nama);
      if (!valid.length) throw new Error('Tidak ada baris valid. Pastikan kolom nis & nama terisi.');
      // buat kelas baru otomatis
      const kmap = Object.fromEntries(kelas.map((k) => [k.nama.toLowerCase(), k.id]));
      const newK = [...new Set(valid.map((r) => r.kelas).filter((k) => k && !kmap[k.toLowerCase()]))];
      if (newK.length) {
        const ins = await q(supabase.from('kelas').insert(newK.map((nama) => ({ nama }))).select());
        ins.forEach((k) => (kmap[k.nama.toLowerCase()] = k.id));
      }
      const payload = valid.map((r) => ({
        nis: r.nis, nama: r.nama, kelas_id: r.kelas ? kmap[r.kelas.toLowerCase()] : null,
        jk: r.jk || null, password: r.password || randomPassword(), ruang: r.ruang || null, sesi: r.sesi || null,
      }));
      for (let i = 0; i < payload.length; i += 500)
        await q(supabase.from('siswa').upsert(payload.slice(i, i + 500), { onConflict: 'nis' }));
      toast.ok(`${payload.length} siswa berhasil diimpor`);
      load();
    } catch (e) { toast.err(e); } finally { setBusy(false); }
  };

  const exportXls = () => downloadSheet('data_siswa.xlsx', filtered.map((r) => ({
    nis: r.nis, nama: r.nama, kelas: kelasMap[r.kelas_id] || '', jk: r.jk || '', password: r.password, ruang: r.ruang || '', sesi: r.sesi || '',
  })), 'Siswa');

  return (
    <div>
      <div className="page-head">
        <h1>Data Siswa</h1>
        <div className="row">
          <button className="btn ghost sm" onClick={template}><FileSpreadsheet size={16} /> Template</button>
          <button className="btn sky sm" disabled={busy} onClick={() => fileRef.current.click()}><Upload size={16} /> Import Excel</button>
          <button className="btn ghost sm" onClick={exportXls}><Download size={16} /> Export</button>
          <button className="btn amber sm" disabled={busy} onClick={genPasswords}><KeyRound size={16} /> Generate Password</button>
          <button className="btn sm" onClick={() => setEdit({})}><Plus size={16} /> Tambah</button>
          <input ref={fileRef} type="file" hidden accept=".xlsx,.xls,.csv" onChange={(e) => { importFile(e.target.files[0]); e.target.value = ''; }} />
        </div>
      </div>

      <div className="clay">
        <div className="row mb">
          <div className="row grow" style={{ flexWrap: 'nowrap', minWidth: 200 }}>
            <Search size={18} color="#7b7f86" />
            <input className="input" placeholder="Cari NIS / nama..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="input" style={{ width: 200 }} value={fKelas} onChange={(e) => setFKelas(e.target.value)}>
            <option value="">Semua kelas</option>
            {kelas.map((k) => <option key={k.id} value={k.id}>{k.nama}</option>)}
          </select>
          <span className="badge">{filtered.length} siswa</span>
        </div>
        {!rows ? <Spinner /> : filtered.length === 0 ? <Empty text="Belum ada data siswa"><button className="btn ghost sm" onClick={template}>Unduh template import</button></Empty> : (
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>NIS</th><th>Nama</th><th>Kelas</th><th>Password</th><th>Ruang/Sesi</th><th>Login Terakhir</th><th /></tr></thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td>{r.nis}</td>
                    <td className="bold">{r.nama} {r.jk && <span className="tiny muted">({r.jk})</span>}</td>
                    <td>{kelasMap[r.kelas_id] || '-'}</td>
                    <td><code>{r.password}</code></td>
                    <td>{r.ruang || '-'} / {r.sesi || '-'}</td>
                    <td className="small">{r.session_token ? <span className="badge mint">Online</span> : ''} {fmtDate(r.last_login)}</td>
                    <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                      <button className="btn ghost icon sm" title="Reset login" onClick={() => resetLogin(r)}><RotateCcw size={15} /></button>{' '}
                      <button className="btn ghost icon sm" title="Edit" onClick={() => setEdit(r)}><Pencil size={15} /></button>{' '}
                      <button className="btn red icon sm" title="Hapus" onClick={() => del(r)}><Trash2 size={15} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {edit && (
        <Modal title={edit.id ? 'Edit Siswa' : 'Tambah Siswa'} onClose={() => setEdit(null)}
          footer={<><button className="btn ghost" onClick={() => setEdit(null)}>Batal</button><button className="btn" onClick={save}>Simpan</button></>}>
          <div className="grid g2" style={{ gap: 0, columnGap: 14 }}>
            <Field label="NIS / Username"><input className="input" value={edit.nis || ''} onChange={(e) => setEdit({ ...edit, nis: e.target.value })} /></Field>
            <Field label="Nama Lengkap"><input className="input" value={edit.nama || ''} onChange={(e) => setEdit({ ...edit, nama: e.target.value })} /></Field>
            <Field label="Kelas">
              <select className="input" value={edit.kelas_id || ''} onChange={(e) => setEdit({ ...edit, kelas_id: e.target.value })}>
                <option value="">- pilih -</option>
                {kelas.map((k) => <option key={k.id} value={k.id}>{k.nama}</option>)}
              </select>
            </Field>
            <Field label="Jenis Kelamin">
              <select className="input" value={edit.jk || ''} onChange={(e) => setEdit({ ...edit, jk: e.target.value })}>
                <option value="">-</option><option value="L">Laki-laki</option><option value="P">Perempuan</option>
              </select>
            </Field>
            <Field label="Password" hint="Kosongkan untuk dibuat otomatis">
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <input className="input" value={edit.password || ''} onChange={(e) => setEdit({ ...edit, password: e.target.value })} />
                <button type="button" className="btn ghost icon" onClick={() => setEdit({ ...edit, password: randomPassword() })}><KeyRound size={16} /></button>
              </div>
            </Field>
            <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
              <Field label="Ruang"><input className="input" value={edit.ruang || ''} onChange={(e) => setEdit({ ...edit, ruang: e.target.value })} /></Field>
              <Field label="Sesi"><input className="input" value={edit.sesi || ''} onChange={(e) => setEdit({ ...edit, sesi: e.target.value })} /></Field>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
