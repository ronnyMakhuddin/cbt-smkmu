import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, LogIn, ShieldCheck } from 'lucide-react';
import { supabase, translateError } from '../../lib/supabase';
import { useSettings, SchoolLogo } from '../../components/ui';

export default function AdminLogin() {
  const nav = useNavigate();
  const { settings } = useSettings();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => data.session && nav('/admin', { replace: true }));
  }, [nav]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr('');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) return setErr(translateError(error.message));
    nav('/admin', { replace: true });
  };

  return (
    <div className="auth-wrap">
      <div className="blob tint-primary" style={{ width: 220, height: 220, top: -60, right: -40 }} />
      <div className="blob tint-pink" style={{ width: 140, height: 140, bottom: 40, left: -30 }} />
      <form className="clay auth-card" onSubmit={submit}>
        <div className="center mb">
          <div style={{ display: 'inline-block' }}><SchoolLogo size={72} /></div>
          <h1 className="mt">Login Admin</h1>
          <p className="muted small">{settings.nama_sekolah}</p>
        </div>
        <div className="field">
          <label className="label">Email</label>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <Mail size={18} color="#7a7f9a" />
            <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@sekolah.sch.id" />
          </div>
        </div>
        <div className="field">
          <label className="label">Password</label>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <Lock size={18} color="#7a7f9a" />
            <input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
        </div>
        {err && <div className="badge red mb" style={{ display: 'flex', padding: 10 }}>{err}</div>}
        <button className="btn block" disabled={busy}><LogIn size={18} /> {busy ? 'Memproses...' : 'Masuk'}</button>
        <p className="center small mt"><Link to="/"><ShieldCheck size={14} /> Halaman login siswa</Link></p>
      </form>
    </div>
  );
}
