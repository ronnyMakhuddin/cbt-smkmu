import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, BookOpen, ClipboardList, Activity, School, ArrowRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useSettings, SchoolLogo } from '../../components/ui';
import { fmtDate } from '../../lib/util';

const count = async (table, f) => {
  let qq = supabase.from(table).select('*', { count: 'exact', head: true });
  if (f) qq = f(qq);
  const { count: c } = await qq;
  return c || 0;
};

export default function Dashboard() {
  const { settings } = useSettings();
  const [s, setS] = useState({});
  const [ujian, setUjian] = useState([]);

  useEffect(() => {
    (async () => {
      const [siswa, kelas, soal, uj, aktif] = await Promise.all([
        count('siswa'), count('kelas'), count('soal'), count('ujian'),
        count('peserta_ujian', (x) => x.eq('status', 'berlangsung')),
      ]);
      setS({ siswa, kelas, soal, uj, aktif });
      const { data } = await supabase.from('ujian').select('id,nama,mulai,selesai,durasi_menit,token,aktif').order('created_at', { ascending: false }).limit(5);
      setUjian(data || []);
    })();
  }, []);

  const cards = [
    { l: 'Siswa', v: s.siswa, i: Users, c: 'tint-primary', to: '/admin/siswa' },
    { l: 'Butir Soal', v: s.soal, i: BookOpen, c: 'tint-pink', to: '/admin/bank' },
    { l: 'Ujian', v: s.uj, i: ClipboardList, c: 'tint-sky', to: '/admin/ujian' },
    { l: 'Sedang Ujian', v: s.aktif, i: Activity, c: 'tint-mint', to: '/admin/monitoring' },
  ];

  return (
    <div>
      <div className="clay tint-primary mb row" style={{ gap: 18 }}>
        <SchoolLogo size={64} className="tint-pink" />
        <div className="grow">
          <div className="small" style={{ opacity: 0.85 }}>Selamat datang di</div>
          <h1 style={{ color: '#fff' }}>{settings.nama_sekolah}</h1>
          <div className="small" style={{ opacity: 0.85 }}>Tahun Ajaran {settings.tahun_ajaran} · Semester {settings.semester}</div>
        </div>
        <School size={56} style={{ opacity: 0.35 }} className="hide-mobile" />
      </div>

      <div className="grid g4 mb">
        {cards.map((c) => (
          <Link key={c.l} to={c.to} className="clay stat" style={{ textDecoration: 'none', color: 'inherit' }}>
            <div className={`stat-ico ${c.c}`}><c.i size={26} /></div>
            <div>
              <div className="stat-val">{c.v ?? '…'}</div>
              <div className="small muted bold">{c.l}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="clay">
        <div className="row between mb">
          <h2>Ujian Terbaru</h2>
          <Link to="/admin/ujian" className="btn ghost sm">Kelola <ArrowRight size={15} /></Link>
        </div>
        {ujian.length === 0 ? (
          <p className="muted">Belum ada ujian. Buat bank soal lalu jadwalkan ujian.</p>
        ) : (
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>Nama</th><th>Mulai</th><th>Durasi</th><th>Token</th><th>Status</th></tr></thead>
              <tbody>
                {ujian.map((u) => (
                  <tr key={u.id}>
                    <td className="bold">{u.nama}</td>
                    <td>{fmtDate(u.mulai)}</td>
                    <td>{u.durasi_menit} mnt</td>
                    <td><span className="badge">{u.token || '-'}</span></td>
                    <td>{u.aktif ? <span className="badge mint">Aktif</span> : <span className="badge gray">Nonaktif</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="tiny muted mt center">Kelas terdaftar: {s.kelas ?? '…'}</p>
    </div>
  );
}
