import { useEffect, useRef, useState } from 'react';
import { Save, ImagePlus, Trash2, School, KeyRound } from 'lucide-react';
import { supabase, q } from '../../lib/supabase';
import { Field, useToast, useSettings } from '../../components/ui';
import { uploadImage } from '../../lib/upload';

const FIELDS = [
  ['nama_sekolah', 'Nama Sekolah', 'SMK Muhammadiyah ...'],
  ['npsn', 'NPSN', ''],
  ['alamat', 'Alamat', ''],
  ['kota', 'Kota / Kabupaten', 'untuk tanda tangan kartu'],
  ['telepon', 'Telepon', ''],
  ['email', 'Email Sekolah', ''],
  ['kepala_sekolah', 'Nama Kepala Sekolah', ''],
  ['nip_kepsek', 'NIP / NBM Kepala Sekolah', ''],
  ['tahun_ajaran', 'Tahun Ajaran', '2026/2027'],
  ['semester', 'Semester', 'Ganjil'],
  ['judul_ujian', 'Judul Kegiatan Ujian (default kartu)', 'Penilaian Akhir Semester'],
];

export default function Pengaturan() {
  const toast = useToast();
  const { settings, setSettings } = useSettings();
  const fileRef = useRef(null);
  const [form, setForm] = useState(settings);
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState('');

  useEffect(() => setForm(settings), [settings]);

  const save = async (patch = {}) => {
    setBusy(true);
    try {
      const payload = { ...form, ...patch, id: 1, updated_at: new Date().toISOString() };
      const data = await q(supabase.from('settings').upsert(payload).select().single());
      setSettings(data);
      toast.ok('Pengaturan tersimpan');
    } catch (e) { toast.err(e); } finally { setBusy(false); }
  };

  const uploadLogo = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadImage(file, 'logo');
      setForm((f) => ({ ...f, logo_url: url }));
      await save({ logo_url: url });
    } catch (e) { toast.err(e); setBusy(false); }
  };

  const changePw = async () => {
    if (pw.length < 6) return toast.err('Password minimal 6 karakter');
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) return toast.err(error.message);
    setPw('');
    toast.ok('Password admin diganti');
  };

  return (
    <div>
      <div className="page-head"><h1>Pengaturan Sekolah</h1></div>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr)', gap: 18 }}>
        <div className="grid g2" style={{ alignItems: 'start' }}>
          <div className="clay">
            <h2 className="mb">Identitas Sekolah</h2>
            <div className="grid g2" style={{ gap: 0, columnGap: 14 }}>
              {FIELDS.map(([k, l, ph]) => (
                <Field key={k} label={l}>
                  <input className="input" value={form[k] || ''} placeholder={ph} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
                </Field>
              ))}
            </div>
            <button className="btn" disabled={busy} onClick={() => save()}><Save size={17} /> Simpan Pengaturan</button>
          </div>

          <div className="col" style={{ gap: 18 }}>
            <div className="clay center">
              <h2 className="mb">Logo Sekolah</h2>
              <div className="clay-in" style={{ width: 160, height: 160, margin: '0 auto', display: 'grid', placeItems: 'center', borderRadius: 32 }}>
                {form.logo_url ? <img src={form.logo_url} alt="logo" style={{ maxWidth: 130, maxHeight: 130, objectFit: 'contain' }} /> : <School size={64} color="#b4b8d6" />}
              </div>
              <div className="row mt" style={{ justifyContent: 'center' }}>
                <button className="btn pink" disabled={busy} onClick={() => fileRef.current.click()}><ImagePlus size={17} /> Unggah Logo</button>
                {form.logo_url && <button className="btn ghost" disabled={busy} onClick={() => { setForm({ ...form, logo_url: null }); save({ logo_url: null }); }}><Trash2 size={17} /> Hapus</button>}
              </div>
              <p className="tiny muted mt">PNG transparan disarankan. Logo tampil di halaman login, sidebar, dan kartu ujian.</p>
              <input ref={fileRef} type="file" hidden accept="image/*" onChange={(e) => { uploadLogo(e.target.files[0]); e.target.value = ''; }} />
            </div>

            <div className="clay">
              <h2 className="mb">Ganti Password Admin</h2>
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <input className="input" type="password" placeholder="Password baru" value={pw} onChange={(e) => setPw(e.target.value)} />
                <button className="btn amber" onClick={changePw}><KeyRound size={16} /> Ganti</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
