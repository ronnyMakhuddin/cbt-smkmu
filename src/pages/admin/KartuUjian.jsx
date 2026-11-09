import { useEffect, useMemo, useState } from 'react';
import { Printer, IdCard } from 'lucide-react';
import { supabase, q, fetchAll } from '../../lib/supabase';
import { Empty, Spinner, Field, useToast, useSettings, DEFAULT_LOGO } from '../../components/ui';
import { fmtDate } from '../../lib/util';

export default function KartuUjian() {
  const toast = useToast();
  const { settings } = useSettings();
  const [kelas, setKelas] = useState([]);
  const [ujian, setUjian] = useState([]);
  const [siswa, setSiswa] = useState(null);
  const [fKelas, setFKelas] = useState('');
  const [selUjian, setSelUjian] = useState([]);
  const [judul, setJudul] = useState('');
  const [tanggal, setTanggal] = useState(new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }));
  const [showToken, setShowToken] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [k, u, s] = await Promise.all([
          q(supabase.from('kelas').select('*').order('nama')),
          q(supabase.from('ujian').select('id,nama,mulai,durasi_menit,token,kelas_ids,siswa_ids,aktif').order('mulai', { ascending: true, nullsFirst: false })),
          fetchAll(() => supabase.from('siswa').select('*').order('nama')),
        ]);
        setKelas(k); setUjian(u); setSiswa(s);
        setSelUjian(u.filter((x) => x.aktif).map((x) => x.id));
      } catch (e) { toast.err(e); setSiswa([]); }
    })();
  }, []);

  useEffect(() => { if (!judul && settings.judul_ujian) setJudul(settings.judul_ujian); }, [settings]);

  const kelasMap = useMemo(() => Object.fromEntries(kelas.map((k) => [k.id, k.nama])), [kelas]);
  const list = (siswa || []).filter((s) => !fKelas || s.kelas_id === fKelas);
  const chosen = ujian.filter((u) => selUjian.includes(u.id));
  const ujianFor = (s) => chosen.filter((u) => (u.siswa_ids?.length ? u.siswa_ids.includes(s.id) : u.kelas_ids.includes(s.kelas_id)));
  const toggleU = (id) => setSelUjian((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]));

  return (
    <div>
      <div className="page-head no-print">
        <h1>Kartu Ujian</h1>
        <button className="btn" onClick={() => window.print()} disabled={!list.length}><Printer size={17} /> Cetak / Simpan PDF</button>
      </div>

      <div className="clay mb no-print">
        <div className="grid g3" style={{ gap: 0, columnGap: 16 }}>
          <Field label="Kelas">
            <select className="input" value={fKelas} onChange={(e) => setFKelas(e.target.value)}>
              <option value="">Semua kelas</option>
              {kelas.map((k) => <option key={k.id} value={k.id}>{k.nama}</option>)}
            </select>
          </Field>
          <Field label="Judul Kegiatan"><input className="input" value={judul} onChange={(e) => setJudul(e.target.value)} /></Field>
          <Field label="Tanggal Tanda Tangan"><input className="input" value={tanggal} onChange={(e) => setTanggal(e.target.value)} /></Field>
        </div>
        <label className="check mb"><input type="checkbox" checked={showToken} onChange={(e) => setShowToken(e.target.checked)} /> Cantumkan jadwal & token ujian di kartu</label>
        {showToken && (
          <div className="row" style={{ gap: 8 }}>
            <span className="small muted bold">Ujian yang dicantumkan:</span>
            {ujian.length === 0 && <span className="small muted">belum ada ujian</span>}
            {ujian.map((u) => (
              <button key={u.id} className={`btn sm ${selUjian.includes(u.id) ? 'sky' : 'ghost'}`} onClick={() => toggleU(u.id)}>{u.nama}</button>
            ))}
          </div>
        )}
        <p className="tiny muted mt">Tip: pada dialog cetak pilih ukuran A4 dan aktifkan "Background graphics". 8 kartu per halaman.</p>
      </div>

      {!siswa ? <Spinner /> : list.length === 0 ? <div className="clay"><Empty text="Belum ada siswa" icon={IdCard} /></div> : (
        <div className="clay print-area">
          <div className="kartu-sheet">
            {list.map((s) => {
              const uj = ujianFor(s);
              return (
                <div className="kartu" key={s.id}>
                  <div className="kartu-head">
                    <img src={settings.logo_url || DEFAULT_LOGO} alt="" />
                    <div style={{ flex: 1, textAlign: 'center', lineHeight: 1.25 }}>
                      <div style={{ fontWeight: 900, fontSize: 13 }}>KARTU PESERTA UJIAN</div>
                      <div style={{ fontWeight: 700 }}>{judul}</div>
                      <div style={{ fontWeight: 800 }}>{settings.nama_sekolah}</div>
                      <div style={{ fontSize: 10 }}>Tahun Ajaran {settings.tahun_ajaran} · Semester {settings.semester}</div>
                    </div>
                  </div>
                  <table>
                    <tbody>
                      <tr><td style={{ width: 92 }}>Nama</td><td>: <b>{s.nama}</b></td></tr>
                      <tr><td>Kelas</td><td>: {kelasMap[s.kelas_id] || '-'}</td></tr>
                      <tr><td>Ruang / Sesi</td><td>: {s.ruang || '-'} / {s.sesi || '-'}</td></tr>
                      <tr><td>Username</td><td>: <span className="kartu-pass">{s.nis}</span></td></tr>
                      <tr><td>Password</td><td>: <span className="kartu-pass">{s.password}</span></td></tr>
                    </tbody>
                  </table>
                  {showToken && uj.length > 0 && (
                    <table className="tok">
                      <thead><tr><th style={{ textAlign: 'left' }}>Ujian</th><th>Jadwal</th><th>Token</th></tr></thead>
                      <tbody>
                        {uj.map((u) => (
                          <tr key={u.id}>
                            <td>{u.nama}</td>
                            <td style={{ whiteSpace: 'nowrap' }}>{u.mulai ? fmtDate(u.mulai) : '-'}</td>
                            <td className="kartu-pass" style={{ textAlign: 'center' }}>{u.token || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10.5 }}>
                    <div style={{ fontSize: 9.5, maxWidth: '48%', color: '#555' }}>Masuk di: <b>{window.location.host}</b><br />Kartu wajib dibawa saat ujian.</div>
                    <div style={{ textAlign: 'center' }}>
                      {settings.kota ? `${settings.kota}, ` : ''}{tanggal}<br />Kepala Sekolah
                      <div style={{ height: 30 }} />
                      <b><u>{settings.kepala_sekolah || '....................'}</u></b>
                      {settings.nip_kepsek && <div>NIP. {settings.nip_kepsek}</div>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
