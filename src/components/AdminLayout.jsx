import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Database, BookOpen, ClipboardList, MonitorCheck, IdCard, Settings, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Spinner, useSettings, SchoolLogo } from './ui';

export const MENU = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/siswa', label: 'Siswa', icon: Users },
  { to: '/admin/master', label: 'Kelas & Mapel', icon: Database },
  { to: '/admin/bank', label: 'Bank Soal', icon: BookOpen },
  { to: '/admin/ujian', label: 'Ujian', icon: ClipboardList },
  { to: '/admin/monitoring', label: 'Monitoring & Nilai', icon: MonitorCheck },
  { to: '/admin/kartu', label: 'Kartu Ujian', icon: IdCard },
  { to: '/admin/pengaturan', label: 'Pengaturan', icon: Settings },
];

export default function AdminLayout() {
  const nav = useNavigate();
  const { settings } = useSettings();
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session === null) nav('/admin/login', { replace: true });
  }, [session, nav]);

  if (!session) return <Spinner />;

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
            <div className="tiny muted">Panel Admin CBT</div>
          </div>
        </div>
        {MENU.map((m) => (
          <NavLink key={m.to} to={m.to} end={m.end} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <m.icon size={19} /> {m.label}
          </NavLink>
        ))}
        <div style={{ flex: 1 }} />
        <div className="tiny muted" style={{ padding: '0 10px 8px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{session.user.email}</div>
        <button className="btn ghost block" onClick={logout}><LogOut size={17} /> Keluar</button>
      </aside>

      <nav className="bottom-nav clay">
        {MENU.map((m) => (
          <NavLink key={m.to} to={m.to} end={m.end} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <m.icon size={19} /> <span>{m.label.split(' ')[0]}</span>
          </NavLink>
        ))}
        <button className="nav-item" style={{ border: 0, background: 'none', font: 'inherit', cursor: 'pointer' }} onClick={logout}>
          <LogOut size={19} /> <span>Keluar</span>
        </button>
      </nav>

      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
