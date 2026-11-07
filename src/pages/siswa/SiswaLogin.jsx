import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Lock, LogIn, Eye, EyeOff } from 'lucide-react';
import { rpc } from '../../lib/supabase';
import { getSiswa, setSiswa } from '../../lib/siswaSession';
import { useSettings, SchoolLogo } from '../../components/ui';

export default function SiswaLogin() {
  const nav = useNavigate();
  const { settings } = useSettings();
  const [nis, setNis] = useState('');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (getSiswa()?.token) nav('/siswa', { replace: true }); }, [nav]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const s = await rpc('siswa_login', { p_nis: nis.trim(), p_password: pw });
      setSiswa(s);
      nav('/siswa', { replace: true });
    } catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };

  return (
    <div className="auth-wrap">
      <div className="blob tint-sky" style={{ width: 240, height: 240, top: -70, left: -60 }} />
      <div className="blob tint-pink" style={{ width: 160, height: 160, bottom: -30, right: 30 }} />
      <div className="blob tint-amber" style={{ width: 70, height: 70, top: '30%', right: '12%' }} />
      <form className="clay auth-card" onSubmit={submit}>
        <div className="center mb">
          <div style={{ display: 'inline-block' }}><SchoolLogo size={84} /></div>
          <h1 className="mt">{settings.nama_sekolah}</h1>
          <p className="muted small bold">Computer Based Test · {settings.tahun_ajaran}</p>
        </div>
        <div className="field">
          <label className="label">Username / NIS</label>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <User size={18} color="#7b7f86" />
            <input className="input" required autoComplete="username" value={nis} onChange={(e) => setNis(e.target.value)} placeholder="Masukkan NIS" />
          </div>
        </div>
        <div className="field">
          <label className="label">Password</label>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <Lock size={18} color="#7b7f86" />
            <input className="input" required type={show ? 'text' : 'password'} autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password di kartu ujian" />
            <button type="button" className="btn ghost icon" onClick={() => setShow(!show)}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
          </div>
        </div>
        {err && <div className="badge red mb" style={{ display: 'flex', padding: 10, whiteSpace: 'normal' }}>{err}</div>}
        <button className="btn block" disabled={busy}><LogIn size={18} /> {busy ? 'Memeriksa...' : 'Masuk Ujian'}</button>
        <p className="center tiny muted mt"><Link to="/admin/login" style={{ color: 'inherit' }}>Login admin / guru</Link></p>
      </form>
    </div>
  );
}
