import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, RefreshCw, ClipboardList, MonitorCheck, Clock, KeyRound, Copy, Printer, FileText } from 'lucide-react';
import { supabase, q } from '../../lib/supabase';
import { Modal, Empty, Spinner, Field, useToast, useConfirm } from '../../components/ui';
import { useProfil, isAdmin } from '../../components/AdminLayout';
import { fmtDate, toLocalInput, fromLocalInput, randomToken } from '../../lib/util';

const DEFAULT = { durasi_menit: 90, acak_soal: true, acak_opsi: true, tampil_nilai: false, skor_parsial: false, max_pelanggaran: 3, aktif: true, kelas_ids: [] };

export default function Ujian() {
  const toast = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState(null);
  const [banks, setBanks] = useState([]);
  const [kelas, setKelas] = useState([]);
  const [edit, setEdit] = useState(null);
  const [ajar, setAjar] = useState([]);
  const profil = useProfil();
  const admin = isAdmin(profil);

  const load = async () => {
    try {
      const [u, b, k, a] = await Promise.all([
        q(supabase.from('ujian').select('*, bank_soal(nama, mapel(nama), soal(count))').order('created_at', { ascending: false })),
        q(supabase.from('bank_soal').select('id, nama, mapel_id, mapel(nama)').order('nama')),
        q(supabase.from('kelas').select('*').order('nama')),
        admin ? [] : q(supabase.from('pengajaran').select('*').eq('guru_id', profil.id)),
      ]);
      setRows(u); setBanks(b); setKelas(k); setAjar(a);
    } catch (e) { toast.err(e); setRows([]); }
  };
  useEffect(() => { load(); }, []);

  const kelasMap = useMemo(() => Object.fromEntries(kelas.map((k) => [k.id, k.nama])), [kelas]);

  const save = async () => {
    const e = edit;
    if (!e.nama?.trim()) return toast.err('Nama ujian wajib diisi');
    if (!e.bank_id) return toast.err('Pilih bank soal');
    if (!e.kelas_ids?.length) return toast.err('Pilih minimal 1 kelas peserta');
    if (!admin && e.kelas_ids.some((k) => !kelasPilihan.some((x) => x.id === k))) return toast.err('Ada kelas yang bukan kelas ajar Anda untuk mapel ini');
    const p = {
      nama: e.nama.trim(), bank_id: e.bank_id, kelas_ids: e.kelas_ids,
      mulai: fromLocalInput(e.mulai_local), selesai: fromLocalInput(e.selesai_local),
      durasi_menit: Number(e.durasi_menit) || 60, token: (e.token || '').trim().toUpperCase() || null,
      acak_soal: !!e.acak_soal, acak_opsi: !!e.acak_opsi, tampil_nilai: !!e.tampil_nilai, skor_parsial: !!e.skor_parsial,
      max_pelanggaran: Number(e.max_pelanggaran) || 0, aktif: !!e.aktif,
    };
    if (p.mulai && p.selesai && p.selesai <= p.mulai) return toast.err('Waktu selesai harus setelah waktu mulai');
    try {
      if (e.id) await q(supabase.from('ujian').update(p).eq('id', e.id));
      else await q(supabase.from('ujian').insert(p));
      toast.ok('Ujian tersimpan'); setEdit(null); load();
    } catch (err) { toast.err(err); }
  };

  const del = async (u) => {
    if (!(await confirm(`Hapus ujian "${u.nama}"? Semua jawaban & nilai peserta ikut terhapus.`))) return;
    try { await q(supabase.from('ujian').delete().eq('id', u.id)); toast.ok('Dihapus'); load(); } catch (e) { toast.err(e); }
  };

  const newToken = async (u) => {
    const token = randomToken();
    try { await q(supabase.from('ujian').update({ token }).eq('id', u.id)); toast.ok(`Token baru: ${token}`); load(); } catch (e) { toast.err(e); }
  };

  const toggle = async (u) => {
    try { await q(supabase.from('ujian').update({ aktif: !u.aktif }).eq('id', u.id)); load(); } catch (e) { toast.err(e); }
  };

  const openEdit = (u) => setEdit(u
    ? { ...u, mulai_local: toLocalInput(u.mulai), selesai_local: toLocalInput(u.selesai) }
    : { ...DEFAULT, token: randomToken() });

  // kelas yang boleh dipilih: admin semua, guru hanya kelas yang diajar untuk mapel bank soal terpilih
  const bankMapel = banks.find((b) => b.id === edit?.bank_id)?.mapel_id;
  const kelasPilihan = admin ? kelas : kelas.filter((k) => ajar.some((a) => a.mapel_id === bankMapel && a.kelas_id === k.id));
  const toggleKelas = (id) => setEdit((e) => ({ ...e, kelas_ids: e.kelas_ids.includes(id) ? e.kelas_ids.filter((x) => x !== id) : [...e.kelas_ids, id] }));

  return (
    <div>
      <div className="page-head">
        <h1>Jadwal Ujian</h1>
        <button className="btn" onClick={() => openEdit(null)}><Plus size={17} /> Buat Ujian</button>
      </div>

      {!rows ? <Spinner /> : rows.length === 0 ? (
        <div className="clay"><Empty text="Belum ada ujian" icon={ClipboardList} /></div>
      ) : (
        <div className="grid g2">
          {rows.map((u) => (
            <div key={u.id} className="clay col">
              <div className="row between" style={{ alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <h3>{u.nama} {u.siswa_ids?.length > 0 && <span className="badge amber">Susulan · {u.siswa_ids.length} siswa</span>}</h3>
                  <div className="small muted">{u.bank_soal?.mapel?.nama} · {u.bank_soal?.nama} · {u.bank_soal?.soal?.[0]?.count ?? 0} soal</div>
                </div>
                <button className={`badge ${u.aktif ? 'mint' : 'gray'}`} style={{ border: 0, cursor: 'pointer' }} onClick={() => toggle(u)}>
                  {u.aktif ? 'Aktif' : 'Nonaktif'}
                </button>
              </div>
              <div className="clay-in small">
                <div className="row"><Clock size={14} /> {fmtDate(u.mulai)} — {fmtDate(u.selesai)} · <b>{u.durasi_menit} menit</b></div>
                <div className="row mt" style={{ marginTop: 8 }}>
                  <KeyRound size={14} /> Token: <b style={{ fontSize: '1.1rem', letterSpacing: 2 }}>{u.token || '(tanpa token)'}</b>
                  {u.token && <button className="tbtn" onClick={() => { navigator.clipboard?.writeText(u.token); toast.ok('Token disalin'); }}><Copy size={13} /></button>}
                  <button className="tbtn" onClick={() => newToken(u)}><RefreshCw size={13} /> Token baru</button>
                </div>
              </div>
              <div className="row" style={{ gap: 6 }}>
                {u.kelas_ids.map((k) => <span key={k} className="badge sky">{kelasMap[k] || '?'}</span>)}
              </div>
              <div className="row tiny muted" style={{ gap: 8 }}>
                {u.acak_soal && <span>• Acak soal</span>}
                {u.acak_opsi && <span>• Acak opsi</span>}
                {u.tampil_nilai && <span>• Nilai tampil</span>}
                {u.skor_parsial && <span>• Skor parsial</span>}
                <span>• Maks pelanggaran: {u.max_pelanggaran || '∞'}</span>
              </div>
              <div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
                <button className="btn red icon sm" onClick={() => del(u)}><Trash2 size={15} /></button>
                <button className="btn ghost sm" onClick={() => openEdit(u)}><Pencil size={15} /> Edit</button>
                <Link className="btn ghost sm" to={`/admin/bank/${u.bank_id}/cetak?ujian=${u.id}`}><Printer size={15} /> Soal</Link>
                <Link className="btn ghost sm" to={`/admin/administrasi?ujian=${u.id}`}><FileText size={15} /> Administrasi</Link>
                <Link className="btn sm" to={`/admin/monitoring?ujian=${u.id}`}><MonitorCheck size={15} /> Monitoring</Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {edit && (
        <Modal size="lg" title={edit.id ? 'Edit Ujian' : 'Buat Ujian'} onClose={() => setEdit(null)}
          footer={<><button className="btn ghost" onClick={() => setEdit(null)}>Batal</button><button className="btn" onClick={save}>Simpan</button></>}>
          <div className="grid g2" style={{ gap: 0, columnGap: 16 }}>
            <Field label="Nama Ujian"><input className="input" value={edit.nama || ''} placeholder="PAS Matematika Kelas X" onChange={(e) => setEdit({ ...edit, nama: e.target.value })} /></Field>
            <Field label="Bank Soal">
              <select className="input" value={edit.bank_id || ''} onChange={(e) => setEdit({ ...edit, bank_id: e.target.value })}>
                <option value="">- pilih -</option>
                {banks.map((b) => <option key={b.id} value={b.id}>{b.nama} {b.mapel ? `(${b.mapel.nama})` : ''}</option>)}
              </select>
            </Field>
            <Field label="Waktu Mulai" hint="Kosongkan agar bisa dimulai kapan saja"><input type="datetime-local" className="input" value={edit.mulai_local || ''} onChange={(e) => setEdit({ ...edit, mulai_local: e.target.value })} /></Field>
            <Field label="Batas Akhir" hint="Peserta tidak bisa mulai setelah waktu ini"><input type="datetime-local" className="input" value={edit.selesai_local || ''} onChange={(e) => setEdit({ ...edit, selesai_local: e.target.value })} /></Field>
            <Field label="Durasi (menit)"><input type="number" min="1" className="input" value={edit.durasi_menit} onChange={(e) => setEdit({ ...edit, durasi_menit: e.target.value })} /></Field>
            <Field label="Token Ujian" hint="Dibagikan pengawas / tercetak di kartu ujian">
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <input className="input" value={edit.token || ''} style={{ textTransform: 'uppercase', letterSpacing: 2, fontWeight: 800 }} onChange={(e) => setEdit({ ...edit, token: e.target.value })} />
                <button type="button" className="btn ghost icon" onClick={() => setEdit({ ...edit, token: randomToken() })}><RefreshCw size={16} /></button>
              </div>
            </Field>
            <Field label="Maks. pelanggaran sebelum terkunci" hint="0 = tidak dikunci otomatis (tetap tercatat)">
              <input type="number" min="0" className="input" value={edit.max_pelanggaran} onChange={(e) => setEdit({ ...edit, max_pelanggaran: e.target.value })} />
            </Field>
          </div>
          {edit.siswa_ids?.length > 0 && (
            <div className="clay-in mb small">Ujian susulan khusus untuk <b>{edit.siswa_ids.length} siswa</b> terpilih (diatur dari menu Monitoring). Pilihan kelas di bawah diabaikan.</div>
          )}
          <Field label="Kelas Peserta">
            <div className="row" style={{ gap: 8 }}>
              {kelasPilihan.length === 0 && <span className="small muted">{admin ? 'Belum ada kelas' : edit.bank_id ? 'Anda belum ditugaskan mengajar mapel ini di kelas mana pun. Hubungi admin.' : 'Pilih bank soal terlebih dahulu'}</span>}
              {kelasPilihan.map((k) => (
                <button type="button" key={k.id} className={`btn sm ${edit.kelas_ids.includes(k.id) ? 'sky' : 'ghost'}`} onClick={() => toggleKelas(k.id)}>{k.nama}</button>
              ))}
            </div>
          </Field>
          <div className="grid g2 clay-in" style={{ gap: 12 }}>
            {[
              ['acak_soal', 'Acak urutan soal per siswa'],
              ['acak_opsi', 'Acak urutan opsi jawaban'],
              ['tampil_nilai', 'Tampilkan nilai ke siswa setelah selesai'],
              ['skor_parsial', 'Skor parsial untuk PG kompleks'],
              ['aktif', 'Ujian aktif (terlihat oleh siswa)'],
            ].map(([k, l]) => (
              <label key={k} className="check"><input type="checkbox" checked={!!edit[k]} onChange={(e) => setEdit({ ...edit, [k]: e.target.checked })} /> {l}</label>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
