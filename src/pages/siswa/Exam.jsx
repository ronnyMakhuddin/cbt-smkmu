import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Flag, Send, Maximize, ShieldAlert, Lock, CheckCircle2, Clock, Minus, Plus, Cloud, CloudOff, Home, LayoutGrid } from 'lucide-react';
import { rpc } from '../../lib/supabase';
import { getSiswa, clearSiswa, isSessionError } from '../../lib/siswaSession';
import { Modal, Spinner, useToast, SchoolLogo } from '../../components/ui';
import RichText from '../../components/RichText';
import { LETTERS, isAnswered } from '../../lib/util';

const fsSupported = () => !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen);
const isFullscreen = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
const enterFs = async () => {
  const el = document.documentElement;
  try {
    if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  } catch { /* ditolak browser */ }
};
const exitFs = () => {
  try { if (isFullscreen()) (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch { /* abaikan */ }
};

function fmtTime(ms) {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  return (h ? String(h).padStart(2, '0') + ':' : '') + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

export default function Exam() {
  const { pesertaId } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const me = getSiswa();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState(null);
  const [idx, setIdx] = useState(0);
  const [jawaban, setJawaban] = useState({});
  const [ragu, setRagu] = useState([]);
  const [pel, setPel] = useState(0);
  const [offset, setOffset] = useState(0);
  const [batas, setBatas] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [started, setStarted] = useState(false);
  const [guard, setGuard] = useState(false);
  const [warn, setWarn] = useState(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const [result, setResult] = useState(null);
  const [font, setFont] = useState(17);
  const [pending, setPending] = useState({});
  const [showNav, setShowNav] = useState(false);
  const lastViolation = useRef(0);
  const finishing = useRef(false);

  const handleErr = useCallback((e) => {
    if (isSessionError(e)) {
      exitFs(); clearSiswa();
      toast.err('Sesi tidak valid (akun login di perangkat lain?). Silakan login ulang.');
      nav('/', { replace: true });
      return true;
    }
    if (/UJIAN_(SELESAI|TERKUNCI)/.test(e.message)) { load(); return true; }
    return false;
  }, []);

  const load = useCallback(async () => {
    try {
      const d = await rpc('siswa_ambil_soal', { p_token: me.token, p_peserta: pesertaId });
      setOffset(new Date(d.server_now).getTime() - Date.now());
      setBatas(new Date(d.batas_at).getTime());
      setStatus(d.status);
      setPel(d.pelanggaran);
      if (d.status === 'berlangsung') {
        setData(d);
        setJawaban(d.jawaban || {});
        setRagu(d.ragu || []);
      } else {
        setData((old) => old || d);
        if (d.status === 'selesai') setResult({ nilai: d.nilai });
      }
    } catch (e) {
      if (!handleErr(e)) toast.err(e);
    }
  }, [pesertaId]);

  useEffect(() => {
    if (!me?.token) { nav('/', { replace: true }); return; }
    load();
  }, []);

  /* ---------- Timer ---------- */
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const remaining = batas ? batas - (now + offset) : null;

  const finish = useCallback(async (auto = false) => {
    if (finishing.current) return;
    finishing.current = true;
    try {
      const r = await rpc('siswa_selesai', { p_token: me.token, p_peserta: pesertaId });
      setResult(r); setStatus(r.status); setFinishOpen(false);
      exitFs();
      if (auto) toast.ok('Waktu habis. Jawaban otomatis dikumpulkan.');
    } catch (e) {
      if (!handleErr(e)) toast.err(e);
    } finally { finishing.current = false; }
  }, [pesertaId]);

  useEffect(() => {
    if (status === 'berlangsung' && remaining != null && remaining <= 0) finish(true);
  }, [remaining != null && remaining <= 0, status]);

  /* ---------- Ping server (deteksi buka kunci / dikunci / diselesaikan pengawas) ---------- */
  useEffect(() => {
    if (!status || status === 'selesai') return;
    const iv = setInterval(async () => {
      try {
        const p = await rpc('siswa_ping', { p_token: me.token, p_peserta: pesertaId });
        setBatas(new Date(p.batas_at).getTime());
        setOffset(new Date(p.server_now).getTime() - Date.now());
        setPel(p.pelanggaran);
        if (p.status !== status) {
          if (p.status === 'berlangsung') { setStarted(false); load(); }
          else if (p.status === 'selesai') { setStatus('selesai'); exitFs(); load(); }
          else setStatus(p.status);
        }
      } catch (e) { handleErr(e); }
    }, status === 'terkunci' ? 5000 : 20000);
    return () => clearInterval(iv);
  }, [status]);

  /* ---------- Pelanggaran ---------- */
  const violation = useCallback(async (jenis) => {
    const t = Date.now();
    if (t - lastViolation.current < 2500) return;
    lastViolation.current = t;
    try {
      const r = await rpc('siswa_lapor_pelanggaran', { p_token: me.token, p_peserta: pesertaId, p_jenis: jenis });
      setPel(r.pelanggaran);
      if (r.status === 'terkunci') { setStatus('terkunci'); exitFs(); }
      else setWarn({ jenis, n: r.pelanggaran, max: r.max });
    } catch (e) { handleErr(e); }
  }, [pesertaId]);

  const active = started && status === 'berlangsung';

  useEffect(() => {
    if (!active) return;
    const onVis = () => { if (document.hidden) violation('Berpindah tab / aplikasi'); };
    const onBlur = () => setTimeout(() => { if (!document.hasFocus()) violation('Meninggalkan jendela ujian'); }, 300);
    const onFs = () => {
      if (fsSupported() && !isFullscreen()) { setGuard(true); violation('Keluar dari mode layar penuh'); }
      else setGuard(false);
    };
    const block = (e) => e.preventDefault();
    const onKey = (e) => {
      const k = e.key?.toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;
      if (k === 'printscreen') {
        e.preventDefault();
        navigator.clipboard?.writeText('').catch(() => {});
        violation('Mencoba screenshot');
        return;
      }
      if (k === 'f12' || (ctrl && e.shiftKey && ['i', 'j', 'c', 'k'].includes(k)) ||
          (ctrl && ['c', 'v', 'x', 'a', 'p', 's', 'u', 'f', 'r', 'w', 't', 'n'].includes(k)) ||
          k === 'f5' || (e.altKey && ['arrowleft', 'arrowright', 'home'].includes(k)) || k === 'contextmenu') {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const beforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
    const onPop = () => { history.pushState(null, '', location.href); };
    history.pushState(null, '', location.href);

    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', onBlur);
    document.addEventListener('fullscreenchange', onFs);
    document.addEventListener('webkitfullscreenchange', onFs);
    ['contextmenu', 'copy', 'cut', 'paste', 'dragstart', 'selectstart', 'drop'].forEach((ev) => document.addEventListener(ev, block));
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('beforeunload', beforeUnload);
    window.addEventListener('popstate', onPop);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('fullscreenchange', onFs);
      document.removeEventListener('webkitfullscreenchange', onFs);
      ['contextmenu', 'copy', 'cut', 'paste', 'dragstart', 'selectstart', 'drop'].forEach((ev) => document.removeEventListener(ev, block));
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('beforeunload', beforeUnload);
      window.removeEventListener('popstate', onPop);
    };
  }, [active, violation]);

  const begin = async () => {
    if (fsSupported()) {
      await enterFs();
      if (!isFullscreen()) return toast.err('Izinkan mode layar penuh untuk memulai ujian');
    }
    setGuard(false);
    setStarted(true);
  };

  /* ---------- Simpan jawaban (dengan antrean retry) ---------- */
  const send = useCallback(async (soalId, jaw, isRagu) => {
    setPending((p) => ({ ...p, [soalId]: { jaw, isRagu } }));
    try {
      await rpc('siswa_simpan_jawaban', { p_token: me.token, p_peserta: pesertaId, p_soal: soalId, p_jawaban: jaw ?? null, p_ragu: isRagu });
      setPending((p) => {
        if (p[soalId]?.jaw !== jaw || p[soalId]?.isRagu !== isRagu) return p;
        const n = { ...p }; delete n[soalId]; return n;
      });
    } catch (e) {
      handleErr(e);
    }
  }, [pesertaId]);

  useEffect(() => {
    const ids = Object.keys(pending);
    if (!ids.length) return;
    const t = setTimeout(() => ids.forEach((id) => send(id, pending[id].jaw, pending[id].isRagu)), 5000);
    return () => clearTimeout(t);
  }, [pending, send]);

  const soal = data?.soal || [];
  const cur = soal[idx];

  const answer = (val) => {
    const next = { ...jawaban, [cur.id]: val };
    setJawaban(next);
    send(cur.id, val, ragu.includes(cur.id));
  };
  const toggleRagu = () => {
    const on = !ragu.includes(cur.id);
    setRagu(on ? [...ragu, cur.id] : ragu.filter((x) => x !== cur.id));
    send(cur.id, jawaban[cur.id] ?? null, on);
  };

  const answeredCount = useMemo(() => soal.filter((s) => isAnswered(s, jawaban[s.id])).length, [soal, jawaban]);
  const watermark = useMemo(() => Array.from({ length: 60 }, () => `${me?.nama} · ${me?.nis}`), []);

  /* ---------- Tampilan status khusus ---------- */
  if (!data) return <div className="auth-wrap"><Spinner /></div>;

  if (status === 'selesai' || result) {
    return (
      <div className="auth-wrap">
        <div className="clay auth-card center">
          <div className="stat-ico tint-mint" style={{ width: 90, height: 90, margin: '0 auto', borderRadius: 30 }}><CheckCircle2 size={48} /></div>
          <h1 className="mt">Ujian Selesai</h1>
          <p className="muted mt">{data.ujian?.nama}</p>
          {result?.nilai != null ? (
            <div className="clay-in mt"><div className="small muted bold">Nilai kamu</div><div style={{ fontSize: '3rem', fontWeight: 900, color: 'var(--primary)' }}>{result.nilai}</div></div>
          ) : <p className="small mt">Jawabanmu sudah tersimpan. Terima kasih!</p>}
          <button className="btn block mt" onClick={() => nav('/siswa', { replace: true })}><Home size={17} /> Kembali ke Beranda</button>
        </div>
      </div>
    );
  }

  if (status === 'terkunci') {
    return (
      <div className="auth-wrap">
        <div className="clay auth-card center">
          <div className="stat-ico tint-pink" style={{ width: 90, height: 90, margin: '0 auto', borderRadius: 30 }}><Lock size={46} /></div>
          <h1 className="mt">Ujian Terkunci</h1>
          <p className="muted mt">Kamu melakukan {pel} pelanggaran. Hubungi pengawas untuk membuka kunci. Halaman ini akan terbuka otomatis setelah pengawas membuka kunci.</p>
          <div className="spinner" />
          <button className="btn ghost block" onClick={() => nav('/siswa', { replace: true })}><Home size={17} /> Beranda</button>
        </div>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="auth-wrap">
        <div className="clay auth-card center">
          <SchoolLogo size={70} />
          <h2 className="mt">{data.ujian?.nama}</h2>
          <p className="muted small">{data.ujian?.mapel} · {soal.length} soal · sisa waktu {fmtTime(remaining)}</p>
          <div className="clay-in small mt" style={{ textAlign: 'left' }}>
            <ShieldAlert size={16} color="#e5443a" /> <b>Mode anti curang aktif.</b> Jangan keluar layar penuh, berpindah aplikasi, atau membuka tab lain.
            {data.ujian?.max_pelanggaran > 0 && <> Ujian terkunci setelah <b>{data.ujian.max_pelanggaran}</b> pelanggaran (saat ini {pel}).</>}
          </div>
          <button className="btn mint block mt" onClick={begin}><Maximize size={18} /> {answeredCount ? 'Lanjutkan Ujian' : 'Mulai Ujian'}</button>
        </div>
      </div>
    );
  }

  const isRagu = cur && ragu.includes(cur.id);
  const low = remaining != null && remaining < 5 * 60 * 1000;
  const saving = Object.keys(pending).length > 0;

  return (
    <div className="exam" onCopy={(e) => e.preventDefault()}>
      <div className="watermark">{watermark.map((w, i) => <span key={i}>{w}</span>)}</div>

      <div className="exam-top">
        <div className="row" style={{ flexWrap: 'nowrap', minWidth: 0 }}>
          <SchoolLogo size={40} />
          <div style={{ minWidth: 0 }}>
            <div className="bold" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{data.ujian?.nama}</div>
            <div className="tiny muted">{me.nama} · {me.nis}</div>
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <span className={`badge ${saving ? 'amber' : 'mint'}`}>{saving ? <><CloudOff size={12} /> Menyimpan…</> : <><Cloud size={12} /> Tersimpan</>}</span>
          {pel > 0 && <span className="badge red"><ShieldAlert size={12} /> {pel}{data.ujian?.max_pelanggaran ? `/${data.ujian.max_pelanggaran}` : ''}</span>}
          <div className={`timer clay-sm ${low ? 'tint-pink' : ''}`}><Clock size={16} /> {fmtTime(remaining)}</div>
        </div>
      </div>

      <div className="exam-body" style={{ position: 'relative', zIndex: 6 }}>
        <div>
          {cur && (
            <div className="clay" style={{ fontSize: font }}>
              <div className="row between mb">
                <div className="row">
                  <span className="opt-key" style={{ background: 'var(--primary)', color: '#fff', boxShadow: 'none' }}>{idx + 1}</span>
                  <span className="small muted bold">dari {soal.length}</span>
                  {cur.tipe === 'mcma' && <span className="badge sky">Pilih lebih dari satu jawaban</span>}
                  {cur.tipe === 'kategori' && <span className="badge sky">Tentukan {cur.label_kategori.join(' / ')} tiap pernyataan</span>}
                </div>
                <div className="row" style={{ gap: 6 }}>
                  <button className="btn ghost icon sm" onClick={() => setFont((f) => Math.max(13, f - 1))}><Minus size={14} /></button>
                  <span className="small bold">A</span>
                  <button className="btn ghost icon sm" onClick={() => setFont((f) => Math.min(26, f + 1))}><Plus size={14} /></button>
                </div>
              </div>

              <RichText value={cur.pertanyaan} className="mb" />

              <div className="mt">
                {cur.tipe === 'pg' && cur.opsi.map((o, i) => (
                  <div key={o.id} className={`opt ${jawaban[cur.id] === o.id ? 'sel' : ''}`} onClick={() => answer(o.id)}>
                    <span className="opt-key">{LETTERS[i]}</span>
                    <RichText value={o.teks} style={{ paddingTop: 6 }} />
                  </div>
                ))}
                {cur.tipe === 'mcma' && cur.opsi.map((o, i) => {
                  const arr = Array.isArray(jawaban[cur.id]) ? jawaban[cur.id] : [];
                  const on = arr.includes(o.id);
                  return (
                    <div key={o.id} className={`opt ${on ? 'sel' : ''}`} onClick={() => {
                      const next = on ? arr.filter((x) => x !== o.id) : [...arr, o.id];
                      answer(next.length ? next : null);
                    }}>
                      <span className="opt-key sq">{on ? '✓' : LETTERS[i]}</span>
                      <RichText value={o.teks} style={{ paddingTop: 6 }} />
                    </div>
                  );
                })}
                {cur.tipe === 'kategori' && (
                  <div className="table-wrap">
                    <table className="kat-table">
                      <thead><tr><th style={{ textAlign: 'left' }}>Pernyataan</th>{cur.label_kategori.map((l) => <th key={l}>{l}</th>)}</tr></thead>
                      <tbody>
                        {cur.opsi.map((o, i) => {
                          const val = jawaban[cur.id]?.[o.id];
                          return (
                            <tr key={o.id}>
                              <td><div className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}><b>{i + 1}.</b><RichText value={o.teks} /></div></td>
                              {cur.label_kategori.map((l) => (
                                <td key={l} className="center" style={{ width: 110 }}>
                                  <button className={`kat-pick ${val === l ? 'on' : ''}`} onClick={() => answer({ ...(jawaban[cur.id] || {}), [o.id]: l })}>{val === l ? '✓' : '○'}</button>
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="row between mt">
            <button className="btn ghost" disabled={idx === 0} onClick={() => setIdx(idx - 1)}><ChevronLeft size={18} /> Sebelumnya</button>
            <button className={`btn ${isRagu ? 'amber' : 'ghost'}`} onClick={toggleRagu}><Flag size={17} /> Ragu-ragu</button>
            {idx < soal.length - 1
              ? <button className="btn" onClick={() => setIdx(idx + 1)}>Berikutnya <ChevronRight size={18} /></button>
              : <button className="btn mint" onClick={() => setFinishOpen(true)}><Send size={17} /> Selesai</button>}
          </div>
        </div>

        <div>
          <div className="clay" style={{ position: 'sticky', top: 90 }}>
            <div className="row between mb">
              <h3>Nomor Soal</h3>
              <button className="btn ghost sm" onClick={() => setShowNav((v) => !v)} style={{ display: window.innerWidth < 960 ? 'inline-flex' : 'none' }}><LayoutGrid size={14} /></button>
            </div>
            {(showNav || window.innerWidth >= 960) && (
              <>
                <div className="numgrid">
                  {soal.map((s, i) => (
                    <button key={s.id}
                      className={`num ${ragu.includes(s.id) ? 'ragu' : isAnswered(s, jawaban[s.id]) ? 'done' : ''} ${i === idx ? 'cur' : ''}`}
                      onClick={() => { setIdx(i); setShowNav(false); }}>{i + 1}</button>
                  ))}
                </div>
                <div className="row tiny mt" style={{ gap: 10 }}>
                  <span><span className="badge mint">■</span> Dijawab</span>
                  <span><span className="badge amber">■</span> Ragu</span>
                  <span><span className="badge gray">■</span> Belum</span>
                </div>
              </>
            )}
            <div className="small muted mt">Terjawab <b>{answeredCount}</b> dari {soal.length}</div>
            <button className="btn mint block mt" onClick={() => setFinishOpen(true)}><Send size={17} /> Kumpulkan</button>
          </div>
        </div>
      </div>

      {guard && (
        <div className="guard">
          <div className="clay center" style={{ maxWidth: 420 }}>
            <ShieldAlert size={54} color="#e5443a" />
            <h2 className="mt">Kembali ke Layar Penuh</h2>
            <p className="muted mt">Keluar dari layar penuh tercatat sebagai pelanggaran ({pel}{data.ujian?.max_pelanggaran ? ` dari ${data.ujian.max_pelanggaran}` : ''}).</p>
            <button className="btn block mt" onClick={async () => { await enterFs(); if (isFullscreen()) setGuard(false); }}><Maximize size={18} /> Lanjutkan Ujian</button>
          </div>
        </div>
      )}

      {warn && !guard && (
        <Modal title="Peringatan Pelanggaran" onClose={() => setWarn(null)}
          footer={<button className="btn" onClick={() => setWarn(null)}>Saya Mengerti</button>}>
          <div className="row" style={{ flexWrap: 'nowrap' }}>
            <div className="stat-ico tint-pink"><ShieldAlert size={26} /></div>
            <p><b>{warn.jenis}</b> terdeteksi dan dicatat.<br />Pelanggaran ke-{warn.n}{warn.max ? ` dari batas ${warn.max}. Ujian terkunci bila mencapai batas.` : '.'}</p>
          </div>
        </Modal>
      )}

      {finishOpen && (
        <Modal title="Kumpulkan Jawaban?" onClose={() => setFinishOpen(false)}
          footer={<><button className="btn ghost" onClick={() => setFinishOpen(false)}>Periksa Lagi</button>
            <button className="btn mint" onClick={() => finish(false)} disabled={saving}><Send size={16} /> {saving ? 'Menyimpan…' : 'Ya, Kumpulkan'}</button></>}>
          <div className="grid g3" style={{ gap: 10 }}>
            <div className="clay-sm center"><div className="stat-val">{answeredCount}</div><div className="tiny muted bold">Dijawab</div></div>
            <div className="clay-sm center"><div className="stat-val">{soal.length - answeredCount}</div><div className="tiny muted bold">Belum</div></div>
            <div className="clay-sm center"><div className="stat-val">{ragu.length}</div><div className="tiny muted bold">Ragu</div></div>
          </div>
          <p className="small mt">Setelah dikumpulkan, jawaban tidak dapat diubah lagi.</p>
        </Modal>
      )}
    </div>
  );
}
