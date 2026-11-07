import { useEffect, useRef, useState } from 'react';
import { Save, ImagePlus, Trash2, KeyRound } from 'lucide-react';
import { supabase, q } from '../../lib/supabase';
import { Field, useToast, useSettings, DEFAULT_LOGO } from '../../components/ui';
import { uploadImage } from '../../lib/upload';
import { useProfil, isAdmin } from '../../components/AdminLayout';

function PasswordCard() {
  const toast = useToast();
  const [pw, setPw] = useState('');
  const changePw = async () => {
    if (pw.length < 6) return toast.err('Password minimal 6 karakter');
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) return toast.err(error.message);
    setPw('');
    toast.ok('Password berhasil diganti');
  };
  return (
    <div className="clay">
      <h2 className="mb">Ganti Password Akun</h2>
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <input className="input" type="password" placeholder="Password baru" value={pw} onChange={(e) => setPw(e.target.value)} />
        <button className="btn amber" onClick={changePw}><KeyRound size={16} /> Ganti</button>
      </div>
    </div>
  );
}

export default function Pengaturan() {
  const profil = useProfil();
  if (!isAdmin(profil)) {
    return (
      <div>
        <div className="page-head"><h1>Akun Saya</h1></div>
        <div className="grid g2" style={{ alignItems: 'start' }}>
          <div className="clay">
            <h2 className="mb">{profil?.nama}</h2>
            <p className="muted">{profil?.email} · Guru</p>
            <p className="small muted mt">Hubungi admin untuk mengubah nama, email, atau mapel yang diampu.</p>
          </div>
          <PasswordCard />
        </div>
      </div>
    );
  }
  return <PengaturanSekolah />;
}

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

function PengaturanSekolah() {
  const toast = useToast();
  const { settings, setSettings } = useSettings();
  const fileRef = useRef(null);
  const [form, setForm] = useState(settings);
  const [busy, setBusy] = useState(false);

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
                <img src={form.logo_url || DEFAULT_LOGO} alt="logo" style={{ maxWidth: 130, maxHeight: 130, objectFit: 'contain' }} />
              </div>
              <div className="row mt" style={{ justifyContent: 'center' }}>
                <button className="btn pink" disabled={busy} onClick={() => fileRef.current.click()}><ImagePlus size={17} /> Unggah Logo</button>
                {form.logo_url && <button className="btn ghost" disabled={busy} onClick={() => { setForm({ ...form, logo_url: null }); save({ logo_url: null }); }}><Trash2 size={17} /> Pakai Logo Bawaan</button>}
              </div>
              <p className="tiny muted mt">PNG transparan disarankan. Bila kosong, logo bawaan SMK Mamba'ul Ulum dipakai. Logo tampil di halaman login, sidebar, dan kartu ujian.</p>
              <input ref={fileRef} type="file" hidden accept="image/*" onChange={(e) => { uploadLogo(e.target.files[0]); e.target.value = ''; }} />
            </div>

            <PasswordCard />
          </div>
        </div>
      </div>
    </div>
  );
}
