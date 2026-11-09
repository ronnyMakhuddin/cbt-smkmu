import { createContext, useContext, useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Database, BookOpen, ClipboardList, MonitorCheck, IdCard, Settings, LogOut, UserCog, ShieldOff, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Spinner, Empty, useSettings, SchoolLogo } from './ui';

const ProfilCtx = createContext(null);
/** profil akun yang login: { id, nama, email, role: 'admin' | 'guru', mapel_ids } */
export const useProfil = () => useContext(ProfilCtx);
export const isAdmin = (p) => p?.role === 'admin';

/** Bungkus halaman khusus admin */
export function AdminOnly({ children }) {
  const p = useProfil();
  if (!isAdmin(p)) return <div className="clay"><Empty text="Halaman ini khusus admin" icon={ShieldOff} /></div>;
  return children;
}

export const MENU = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/siswa', label: 'Siswa', icon: Users, admin: true },
  { to: '/admin/master', label: 'Kelas & Mapel', icon: Database, admin: true },
  { to: '/admin/guru', label: 'Guru & Admin', icon: UserCog, admin: true },
  { to: '/admin/bank', label: 'Bank Soal', icon: BookOpen },
  { to: '/admin/ujian', label: 'Ujian', icon: ClipboardList },
  { to: '/admin/monitoring', label: 'Monitoring & Nilai', icon: MonitorCheck },
  { to: '/admin/administrasi', label: 'Administrasi', icon: FileText },
  { to: '/admin/kartu', label: 'Kartu Ujian', icon: IdCard, admin: true },
  { to: '/admin/pengaturan', label: 'Pengaturan', icon: Settings },
];

export default function AdminLayout() {
  const nav = useNavigate();
  const { settings } = useSettings();
  const [session, setSession] = useState(undefined);
  const [profil, setProfil] = useState(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === null) nav('/admin/login', { replace: true });
  }, [session, nav]);

  useEffect(() => {
    if (!session) return;
    supabase.rpc('profil_saya').then(async ({ data, error }) => {
      if (error || !data) {
        setDenied(error?.message || 'Akun ini belum terdaftar sebagai admin/guru. Minta admin menambahkannya di menu Guru & Admin.');
        await supabase.auth.signOut();
        return;
      }
      setProfil(data);
    });
  }, [session?.user?.id]);

  if (denied) return (
    <div className="auth-wrap"><div className="clay auth-card center">
      <ShieldOff size={48} color="#e5443a" /><h2 className="mt">Akses ditolak</h2><p className="muted mt">{denied}</p>
      <button className="btn block mt" onClick={() => { setDenied(false); nav('/admin/login', { replace: true }); }}>Kembali</button>
    </div></div>
  );
  if (!session || !profil) return <Spinner />;
  const menu = MENU.filter((m) => !m.admin || isAdmin(profil));

  const logout = async () => {
    await supabase.auth.signOut();
    nav('/admin/login', { replace: true });
  };

  return (
    <div className="shell">
      <aside className="sidebar clay">
        <div className="brand">
          <SchoolLogo />
          <div style={{ minWidth: 0 }}>
            <div className="bold" style={{ lineHeight: 1.15 }}>{settings.nama_sekolah || 'CBT SMK'}</div>
            <div className="tiny muted">{isAdmin(profil) ? 'Panel Admin CBT' : 'Panel Guru CBT'}</div>
          </div>
        </div>
        {menu.map((m) => (
          <NavLink key={m.to} to={m.to} end={m.end} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <m.icon size={19} /> {m.label}
          </NavLink>
        ))}
        <div style={{ flex: 1 }} />
        <div className="tiny muted" style={{ padding: '0 10px 8px', overflow: 'hidden', textOverflow: 'ellipsis' }}><b>{profil.nama}</b> · {profil.role}<br />{session.user.email}</div>
        <button className="btn ghost block" onClick={logout}><LogOut size={17} /> Keluar</button>
      </aside>

      <nav className="bottom-nav clay">
        {menu.map((m) => (
          <NavLink key={m.to} to={m.to} end={m.end} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <m.icon size={19} /> <span>{m.label.split(' ')[0]}</span>
          </NavLink>
        ))}
        <button className="nav-item" style={{ border: 0, background: 'none', font: 'inherit', cursor: 'pointer' }} onClick={logout}>
          <LogOut size={19} /> <span>Keluar</span>
        </button>
      </nav>

      <main className="main">
        <ProfilCtx.Provider value={profil}><Outlet /></ProfilCtx.Provider>
      </main>
    </div>
  );
}
