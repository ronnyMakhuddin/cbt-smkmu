import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw, Unlock, Square, RotateCcw, LogOut, Download, Calculator, ShieldAlert, MonitorCheck } from 'lucide-react';
import { supabase, q, rpc, fetchAll } from '../../lib/supabase';
import { Modal, Empty, Spinner, useToast, useConfirm } from '../../components/ui';
import { downloadSheet } from '../../lib/excel';
import { fmtDate } from '../../lib/util';

const STATUS = {
  belum: ['Belum mulai', 'gray'],
  berlangsung: ['Mengerjakan', 'sky'],
  selesai: ['Selesai', 'mint'],
  terkunci: ['Terkunci', 'red'],
};

export default function Monitoring() {
  const toast = useToast();
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();
  const ujianId = params.get('ujian') || '';
  const [ujianList, setUjianList] = useState([]);
  const [ujian, setUjian] = useState(null);
  const [rows, setRows] = useState(null);
  const [kelas, setKelas] = useState([]);
  const [fKelas, setFKelas] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [auto, setAuto] = useState(true);
  const [logs, setLogs] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [u, k] = await Promise.all([
          q(supabase.from('ujian').select('id,nama').order('created_at', { ascending: false })),
          q(supabase.from('kelas').select('*').order('nama')),
        ]);
        setUjianList(u); setKelas(k);
        if (!ujianId && u[0]) setParams({ ujian: u[0].id }, { replace: true });
      } catch (e) { toast.err(e); }
    })();
  }, []);

  const load = useCallback(async () => {
    if (!ujianId) return;
    try {
      await rpc('admin_finalisasi_kadaluarsa', { p_ujian: ujianId }).catch(() => {});
      const u = await q(supabase.from('ujian').select('*, bank_soal(nama, soal(count))').eq('id', ujianId).single());
      const [siswa, peserta] = await Promise.all([
        u.kelas_ids.length ? fetchAll(() => supabase.from('siswa').select('id,nis,nama,kelas_id,session_token,last_seen').in('kelas_id', u.kelas_ids).order('nama')) : [],
        fetchAll(() => supabase.from('peserta_ujian').select('id,siswa_id,status,mulai_at,batas_at,selesai_at,nilai,benar,pelanggaran,jawaban').eq('ujian_id', ujianId)),
      ]);
      const pMap = Object.fromEntries(peserta.map((p) => [p.siswa_id, p]));
      setUjian(u);
      setRows(siswa.map((s) => ({ ...s, p: pMap[s.id] || null, status: pMap[s.id]?.status || 'belum' })));
    } catch (e) { toast.err(e); setRows([]); }
  }, [ujianId]);

  useEffect(() => { setRows(null); load(); }, [load]);
  useEffect(() => {
    if (!auto) return;
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [auto, load]);

  const kelasMap = useMemo(() => Object.fromEntries(kelas.map((k) => [k.id, k.nama])), [kelas]);
  const total = ujian?.bank_soal?.soal?.[0]?.count || 0;
  const filtered = (rows || []).filter((r) => (!fKelas || r.kelas_id === fKelas) && (!fStatus || r.status === fStatus));
  const stats = useMemo(() => {
    const s = { belum: 0, berlangsung: 0, selesai: 0, terkunci: 0 };
    (rows || []).forEach((r) => s[r.status]++);
    const nilai = (rows || []).filter((r) => r.p?.nilai != null).map((r) => Number(r.p.nilai));
    s.rata = nilai.length ? (nilai.reduce((a, b) => a + b, 0) / nilai.length).toFixed(1) : '-';
    s.max = nilai.length ? Math.max(...nilai) : '-';
    s.min = nilai.length ? Math.min(...nilai) : '-';
    return s;
  }, [rows]);

  const act = async (fn, msg) => { try { await fn(); toast.ok(msg); load(); } catch (e) { toast.err(e); } };

  const unlock = (r) => act(() => q(supabase.from('peserta_ujian').update({ status: 'berlangsung', pelanggaran: 0 }).eq('id', r.p.id)), `${r.nama} dibuka kembali`);
  const forceFinish = async (r) => { if (await confirm(`Selesaikan paksa ujian ${r.nama}?`)) act(() => rpc('admin_selesaikan', { p_peserta: r.p.id }), 'Ujian diselesaikan'); };
  const resetPeserta = async (r) => {
    if (await confirm(`Reset ujian ${r.nama}? Semua jawaban dihapus dan siswa dapat mengulang dari awal.`))
      act(() => q(supabase.from('peserta_ujian').delete().eq('id', r.p.id)), 'Ujian peserta direset');
  };
  const resetLogin = (r) => act(() => q(supabase.from('siswa').update({ session_token: null }).eq('id', r.id)), `Login ${r.nama} direset`);
  const hitungUlang = () => act(() => rpc('admin_hitung_ulang', { p_ujian: ujianId }), 'Nilai dihitung ulang');
  const showLog = async (r) => {
    try {
      const l = await q(supabase.from('log_pelanggaran').select('*').eq('peserta_id', r.p.id).order('created_at'));
      setLogs({ nama: r.nama, items: l });
    } catch (e) { toast.err(e); }
  };

  const exportXls = () => downloadSheet(`nilai_${ujian?.nama || 'ujian'}.xlsx`, filtered.map((r, i) => ({
    No: i + 1, NIS: r.nis, Nama: r.nama, Kelas: kelasMap[r.kelas_id] || '', Status: STATUS[r.status][0],
    Dijawab: r.p ? Object.keys(r.p.jawaban || {}).length : 0, 'Jumlah Soal': total,
    'Benar Penuh': r.p?.benar ?? '', Nilai: r.p?.nilai ?? '', Pelanggaran: r.p?.pelanggaran ?? 0,
    Mulai: r.p ? fmtDate(r.p.mulai_at) : '', Selesai: r.p ? fmtDate(r.p.selesai_at) : '',
  })), 'Nilai', [5, 12, 28, 12, 13, 9, 11, 11, 8, 11, 18, 18]);

  return (
    <div>
      <div className="page-head">
        <h1>Monitoring & Nilai</h1>
        <div className="row">
          <select className="input" style={{ width: 260 }} value={ujianId} onChange={(e) => setParams({ ujian: e.target.value })}>
            {ujianList.length === 0 && <option value="">Belum ada ujian</option>}
            {ujianList.map((u) => <option key={u.id} value={u.id}>{u.nama}</option>)}
          </select>
          <label className="check small"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Auto refresh</label>
          <button className="btn ghost icon" onClick={load} title="Muat ulang"><RefreshCw size={17} /></button>
        </div>
      </div>

      {!ujianId ? <div className="clay"><Empty text="Belum ada ujian" icon={MonitorCheck} /></div> : (
        <>
          <div className="grid g4 mb">
            {[['Belum mulai', stats.belum, 'tint-amber'], ['Mengerjakan', stats.berlangsung, 'tint-sky'], ['Selesai', stats.selesai, 'tint-mint'], ['Terkunci', stats.terkunci, 'tint-pink']].map(([l, v, c]) => (
              <div key={l} className={`clay ${c}`}>
                <div className="stat-val">{v}</div><div className="small bold" style={{ opacity: 0.9 }}>{l}</div>
              </div>
            ))}
          </div>
          <div className="clay">
            <div className="row between mb">
              <div className="row">
                <select className="input" style={{ width: 170 }} value={fKelas} onChange={(e) => setFKelas(e.target.value)}>
                  <option value="">Semua kelas</option>
                  {(ujian?.kelas_ids || []).map((k) => <option key={k} value={k}>{kelasMap[k]}</option>)}
                </select>
                <select className="input" style={{ width: 160 }} value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
                  <option value="">Semua status</option>
                  {Object.entries(STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
                </select>
                <span className="small muted">Rata-rata <b>{stats.rata}</b> · Tertinggi <b>{stats.max}</b> · Terendah <b>{stats.min}</b></span>
              </div>
              <div className="row">
                <button className="btn ghost sm" onClick={hitungUlang}><Calculator size={15} /> Hitung Ulang</button>
                <button className="btn mint sm" onClick={exportXls}><Download size={15} /> Export Nilai</button>
              </div>
            </div>
            {!rows ? <Spinner /> : filtered.length === 0 ? <Empty text="Tidak ada peserta" /> : (
              <div className="table-wrap">
                <table className="t">
                  <thead><tr><th>Siswa</th><th>Kelas</th><th>Status</th><th>Progres</th><th>Pelanggaran</th><th>Nilai</th><th>Aksi</th></tr></thead>
                  <tbody>
                    {filtered.map((r) => {
                      const dijawab = r.p ? Object.keys(r.p.jawaban || {}).length : 0;
                      const online = r.last_seen && Date.now() - new Date(r.last_seen) < 90000;
                      return (
                        <tr key={r.id}>
                          <td><div className="bold">{r.nama}</div><div className="tiny muted">{r.nis} {online && <span className="badge mint" style={{ padding: '1px 6px' }}>online</span>}</div></td>
                          <td>{kelasMap[r.kelas_id]}</td>
                          <td><span className={`badge ${STATUS[r.status][1]}`}>{STATUS[r.status][0]}</span></td>
                          <td style={{ minWidth: 120 }}>
                            <div className="clay-in" style={{ padding: 3, borderRadius: 10 }}>
                              <div style={{ height: 8, borderRadius: 8, width: `${total ? (dijawab / total) * 100 : 0}%`, background: 'var(--primary)' }} />
                            </div>
                            <div className="tiny muted">{dijawab}/{total}</div>
                          </td>
                          <td>{r.p?.pelanggaran ? <button className="badge red" style={{ border: 0, cursor: 'pointer' }} onClick={() => showLog(r)}><ShieldAlert size={12} /> {r.p.pelanggaran}</button> : <span className="muted">0</span>}</td>
                          <td className="bold" style={{ fontSize: '1.05rem' }}>{r.p?.nilai ?? '-'}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            {r.status === 'terkunci' && <button className="btn mint sm" onClick={() => unlock(r)}><Unlock size={14} /> Buka</button>}{' '}
                            {r.status === 'berlangsung' && <button className="btn amber icon sm" title="Selesaikan paksa" onClick={() => forceFinish(r)}><Square size={14} /></button>}{' '}
                            {r.p && <button className="btn red icon sm" title="Reset ujian (ulang dari awal)" onClick={() => resetPeserta(r)}><RotateCcw size={14} /></button>}{' '}
                            {r.session_token && <button className="btn ghost icon sm" title="Reset login" onClick={() => resetLogin(r)}><LogOut size={14} /></button>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {logs && (
        <Modal title={`Log Pelanggaran: ${logs.nama}`} onClose={() => setLogs(null)}>
          {logs.items.length === 0 ? <Empty /> : (
            <table className="t">
              <tbody>{logs.items.map((l) => <tr key={l.id}><td>{fmtDate(l.created_at)}</td><td className="bold">{l.jenis}</td></tr>)}</tbody>
            </table>
          )}
        </Modal>
      )}
    </div>
  );
}
