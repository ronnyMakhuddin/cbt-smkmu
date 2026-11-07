import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, PlayCircle, CheckCircle2, Lock, Clock, BookOpen, KeyRound, RefreshCw } from 'lucide-react';
import { rpc } from '../../lib/supabase';
import { getSiswa, clearSiswa, isSessionError } from '../../lib/siswaSession';
import { Modal, Empty, Spinner, useToast, SchoolLogo, useSettings } from '../../components/ui';
import { fmtDate } from '../../lib/util';

export default function SiswaHome() {
  const nav = useNavigate();
  const toast = useToast();
  const { settings } = useSettings();
  const [me] = useState(getSiswa());
  const [list, setList] = useState(null);
  const [pick, setPick] = useState(null);
  const [kode, setKode] = useState('');
  const [busy, setBusy] = useState(false);

  const logout = useCallback(async () => {
    try { await rpc('siswa_logout', { p_token: me?.token }); } catch { /* abaikan */ }
    clearSiswa();
    nav('/', { replace: true });
  }, [me, nav]);

  const load = useCallback(async () => {
    try {
      setList(await rpc('siswa_daftar_ujian', { p_token: me.token }));
    } catch (e) {
      if (isSessionError(e)) { toast.err('Sesi berakhir, silakan login ulang'); clearSiswa(); nav('/', { replace: true }); }
      else { toast.err(e); setList([]); }
    }
  }, [me]);

  useEffect(() => { if (!me?.token) nav('/', { replace: true }); else load(); }, []);

  const start = async () => {
    setBusy(true);
    try {
      const pid = await rpc('siswa_mulai_ujian', { p_token: me.token, p_ujian: pick.id, p_kode: kode });
      nav(`/ujian/${pid}`);
    } catch (e) { toast.err(e); load(); } finally { setBusy(false); }
  };

  if (!me) return null;
  const now = Date.now();

  return (
    <div style={{ maxWidth: 980, margin: '0 auto', padding: '20px 16px 60px' }}>
      <div className="clay tint-primary row mb" style={{ gap: 16 }}>
        <SchoolLogo size={58} className="tint-pink" />
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="small" style={{ opacity: 0.85 }}>{settings.nama_sekolah}</div>
          <h2 style={{ color: '#fff' }}>Halo, {me.nama}</h2>
          <div className="small" style={{ opacity: 0.9 }}>NIS {me.nis} · Kelas {me.kelas || '-'} {me.ruang ? `· Ruang ${me.ruang}` : ''}</div>
        </div>
        <button className="btn ghost" onClick={logout}><LogOut size={17} /> Keluar</button>
      </div>

      <div className="row between mb">
        <h2>Daftar Ujian</h2>
        <button className="btn ghost sm" onClick={load}><RefreshCw size={15} /> Muat ulang</button>
      </div>

      {!list ? <Spinner /> : list.length === 0 ? (
        <div className="clay"><Empty text="Belum ada ujian untuk kelasmu" icon={BookOpen} /></div>
      ) : (
        <div className="grid g2">
          {list.map((u) => {
            const belumMulai = u.mulai && new Date(u.mulai).getTime() > now;
            const lewat = u.selesai && new Date(u.selesai).getTime() < now && !u.status;
            return (
              <div key={u.id} className="clay col">
                <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                  <div className={`stat-ico ${u.status === 'selesai' ? 'tint-mint' : u.status === 'terkunci' ? 'tint-pink' : 'tint-sky'}`}>
                    {u.status === 'selesai' ? <CheckCircle2 size={26} /> : u.status === 'terkunci' ? <Lock size={26} /> : <BookOpen size={26} />}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <h3>{u.nama}</h3>
                    <div className="small muted">{u.mapel || '-'} · {u.jumlah_soal} soal · {u.durasi_menit} menit</div>
                  </div>
                </div>
                <div className="small clay-in" style={{ padding: 10 }}>
                  <Clock size={13} /> {fmtDate(u.mulai)} — {fmtDate(u.selesai)}
                </div>
                <div className="row between">
                  {u.status === 'selesai' ? (
                    <span className="badge mint">Selesai {u.nilai != null && `· Nilai ${u.nilai}`}</span>
                  ) : u.status === 'terkunci' ? (
                    <span className="badge red">Terkunci, hubungi pengawas</span>
                  ) : belumMulai ? (
                    <span className="badge amber">Belum dimulai</span>
                  ) : lewat ? (
                    <span className="badge gray">Jadwal berakhir</span>
                  ) : (
                    <span className={`badge ${u.status ? 'sky' : 'gray'}`}>{u.status ? 'Sedang dikerjakan' : 'Siap dikerjakan'}</span>
                  )}
                  {!['selesai'].includes(u.status) && !belumMulai && !lewat && (
                    <button className="btn sm mint" onClick={() => { setPick(u); setKode(''); }}>
                      <PlayCircle size={16} /> {u.status ? 'Lanjutkan' : 'Mulai'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pick && (
        <Modal title={pick.nama} onClose={() => setPick(null)}
          footer={<><button className="btn ghost" onClick={() => setPick(null)}>Batal</button>
            <button className="btn mint" disabled={busy} onClick={start}><PlayCircle size={17} /> {busy ? 'Memuat...' : 'Mulai Ujian'}</button></>}>
          {pick.pakai_token && (
            <div className="field">
              <label className="label"><KeyRound size={13} /> Token Ujian</label>
              <input className="input" autoFocus value={kode} onChange={(e) => setKode(e.target.value.toUpperCase())}
                style={{ fontSize: '1.4rem', letterSpacing: 6, textAlign: 'center', fontWeight: 900 }} placeholder="TOKEN" />
            </div>
          )}
          <div className="clay-in small">
            <b>Tata tertib ujian:</b>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18, lineHeight: 1.6 }}>
              <li>Ujian berjalan dalam mode layar penuh.</li>
              <li>Dilarang berpindah tab/aplikasi, keluar layar penuh, menyalin, atau membuka menu lain. Setiap pelanggaran tercatat.</li>
              <li>Ujian akan <b>terkunci otomatis</b> bila pelanggaran mencapai batas.</li>
              <li>Jawaban tersimpan otomatis. Waktu terus berjalan meski halaman ditutup.</li>
            </ul>
          </div>
        </Modal>
      )}
    </div>
  );
}
