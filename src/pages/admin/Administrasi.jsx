import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Printer, ClipboardCheck, FileText, Users } from 'lucide-react';
import { supabase, q, fetchAll } from '../../lib/supabase';
import { Empty, Spinner, Field, useToast, useSettings } from '../../components/ui';
import Kop, { hariTanggal, jam } from '../../components/Kop';

export default function Administrasi() {
  const toast = useToast();
  const { settings } = useSettings();
  const [params, setParams] = useSearchParams();
  const ujianId = params.get('ujian') || '';
  const tab = params.get('tab') || 'hadir';
  const [ujianList, setUjianList] = useState([]);
  const [kelas, setKelas] = useState([]);
  const [ujian, setUjian] = useState(null);
  const [siswa, setSiswa] = useState(null);
  const [peserta, setPeserta] = useState({});
  const [f, setF] = useState({ kelas: '', ruang: '', sesi: '', otomatis: true, pengawas: '', nip: '', pengawas2: '', nip2: '', catatan: '', tanggal: '', mulai: '', selesai: '' });
  const set = (p) => setF((o) => ({ ...o, ...p }));
  const go = (p) => setParams({ ujian: ujianId, tab, ...p });

  useEffect(() => {
    (async () => {
      try {
        const [u, k] = await Promise.all([
          q(supabase.from('ujian').select('id,nama').order('created_at', { ascending: false })),
          q(supabase.from('kelas').select('*').order('nama')),
        ]);
        setUjianList(u); setKelas(k);
        if (!ujianId && u[0]) setParams({ ujian: u[0].id, tab }, { replace: true });
      } catch (e) { toast.err(e); }
    })();
  }, []);

  useEffect(() => {
    if (!ujianId) return;
    setSiswa(null);
    (async () => {
      try {
        const u = await q(supabase.from('ujian').select('*, bank_soal(nama, mapel(nama))').eq('id', ujianId).single());
        const [s, p] = await Promise.all([
          u.siswa_ids?.length
            ? fetchAll(() => supabase.from('siswa').select('id,nis,nama,kelas_id,ruang,sesi').in('id', u.siswa_ids).order('nama'))
            : u.kelas_ids.length ? fetchAll(() => supabase.from('siswa').select('id,nis,nama,kelas_id,ruang,sesi').in('kelas_id', u.kelas_ids).order('nama')) : [],
          fetchAll(() => supabase.from('peserta_ujian').select('siswa_id,status,mulai_at,selesai_at,pelanggaran').eq('ujian_id', ujianId)),
        ]);
        setUjian(u); setSiswa(s);
        setPeserta(Object.fromEntries(p.map((x) => [x.siswa_id, x])));
        const durasi = u.durasi_menit;
        set({
          kelas: '', ruang: '', sesi: '',
          tanggal: hariTanggal(u.mulai || undefined),
          mulai: u.mulai ? jam(u.mulai) : '',
          selesai: u.mulai ? jam(new Date(new Date(u.mulai).getTime() + durasi * 60000)) : '',
        });
      } catch (e) { toast.err(e); setSiswa([]); }
    })();
  }, [ujianId]);

  const kelasMap = useMemo(() => Object.fromEntries(kelas.map((k) => [k.id, k.nama])), [kelas]);
  const ruangList = useMemo(() => [...new Set((siswa || []).map((s) => s.ruang).filter(Boolean))].sort(), [siswa]);
  const sesiList = useMemo(() => [...new Set((siswa || []).map((s) => s.sesi).filter(Boolean))].sort(), [siswa]);
  const list = (siswa || []).filter((s) => (!f.kelas || s.kelas_id === f.kelas) && (!f.ruang || s.ruang === f.ruang) && (!f.sesi || s.sesi === f.sesi));
  const hadir = list.filter((s) => peserta[s.id]);
  const absen = list.filter((s) => !peserta[s.id]);
  const pelanggar = list.filter((s) => peserta[s.id]?.pelanggaran > 0);
  const kelasLabel = f.kelas ? kelasMap[f.kelas] : [...new Set(list.map((s) => kelasMap[s.kelas_id]).filter(Boolean))].sort().join(', ');
  const mapel = ujian?.bank_soal?.mapel?.nama || '-';

  const catatanOtomatis = () => {
    const parts = [];
    if (absen.length) parts.push(`Peserta tidak hadir: ${absen.map((s) => `${s.nama} (${s.nis})`).join(', ')}.`);
    if (pelanggar.length) parts.push(`Pelanggaran tercatat sistem: ${pelanggar.map((s) => `${s.nama} (${peserta[s.id].pelanggaran}x)`).join(', ')}.`);
    if (!parts.length) parts.push('Ujian berjalan tertib dan lancar.');
    set({ catatan: parts.join('\n') });
  };

  const Identitas = () => (
    <table className="info" style={{ width: '100%', marginBottom: 10 }}>
      <tbody>
        <tr><td style={{ width: 130 }}>Nama Ujian</td><td>: {ujian?.nama}</td><td style={{ width: 110 }}>Hari/Tanggal</td><td>: {f.tanggal}</td></tr>
        <tr><td>Mata Pelajaran</td><td>: {mapel}</td><td>Waktu</td><td>: {f.mulai || '.....'} – {f.selesai || '.....'}</td></tr>
        <tr><td>Kelas</td><td>: {kelasLabel || '-'}</td><td>Ruang / Sesi</td><td>: {f.ruang || '.....'} / {f.sesi || '.....'}</td></tr>
      </tbody>
    </table>
  );

  const TTD = () => (
    <div className="ttd">
      <div>{f.pengawas2 ? <>Pengawas 2<div style={{ height: 56 }} /><b><u>{f.pengawas2}</u></b>{f.nip2 && <div>NIP. {f.nip2}</div>}</> : null}</div>
      <div>
        {settings.kota ? `${settings.kota}, ` : ''}{f.tanggal.replace(/^[^,]+,\s*/, '')}<br />Pengawas{f.pengawas2 ? ' 1' : ''}
        <div style={{ height: 56 }} />
        <b><u>{f.pengawas || '.................................'}</u></b>
        {f.nip && <div>NIP. {f.nip}</div>}
      </div>
    </div>
  );

  return (
    <div>
      <div className="page-head no-print">
        <h1>Administrasi Ujian</h1>
        <div className="row">
          <select className="input" style={{ width: 260 }} value={ujianId} onChange={(e) => setParams({ ujian: e.target.value, tab })}>
            {ujianList.length === 0 && <option value="">Belum ada ujian</option>}
            {ujianList.map((u) => <option key={u.id} value={u.id}>{u.nama}</option>)}
          </select>
          <button className="btn" onClick={() => window.print()} disabled={!list.length}><Printer size={17} /> Cetak</button>
        </div>
      </div>

      <div className="row mb no-print">
        <button className={`btn sm ${tab === 'hadir' ? '' : 'ghost'}`} onClick={() => go({ tab: 'hadir' })}><ClipboardCheck size={15} /> Daftar Hadir</button>
        <button className={`btn sm ${tab === 'berita' ? '' : 'ghost'}`} onClick={() => go({ tab: 'berita' })}><FileText size={15} /> Berita Acara</button>
      </div>

      {!ujianId ? <div className="clay"><Empty text="Belum ada ujian" /></div> : !siswa ? <Spinner /> : (
        <>
          <div className="clay mb no-print">
            <div className="grid g4" style={{ gap: 0, columnGap: 14 }}>
              <Field label="Kelas">
                <select className="input" value={f.kelas} onChange={(e) => set({ kelas: e.target.value })}>
                  <option value="">Semua kelas peserta</option>
                  {(ujian?.kelas_ids || []).map((k) => <option key={k} value={k}>{kelasMap[k]}</option>)}
                </select>
              </Field>
              <Field label="Ruang">
                <select className="input" value={f.ruang} onChange={(e) => set({ ruang: e.target.value })}>
                  <option value="">Semua ruang</option>
                  {ruangList.map((r) => <option key={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="Sesi">
                <select className="input" value={f.sesi} onChange={(e) => set({ sesi: e.target.value })}>
                  <option value="">Semua sesi</option>
                  {sesiList.map((r) => <option key={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="Hari/Tanggal"><input className="input" value={f.tanggal} onChange={(e) => set({ tanggal: e.target.value })} /></Field>
              <Field label="Jam mulai"><input className="input" value={f.mulai} placeholder="07.30" onChange={(e) => set({ mulai: e.target.value })} /></Field>
              <Field label="Jam selesai"><input className="input" value={f.selesai} placeholder="09.00" onChange={(e) => set({ selesai: e.target.value })} /></Field>
              <Field label="Nama Pengawas"><input className="input" value={f.pengawas} onChange={(e) => set({ pengawas: e.target.value })} /></Field>
              <Field label="NIP Pengawas"><input className="input" value={f.nip} onChange={(e) => set({ nip: e.target.value })} /></Field>
              <Field label="Pengawas 2 (opsional)"><input className="input" value={f.pengawas2} onChange={(e) => set({ pengawas2: e.target.value })} /></Field>
              <Field label="NIP Pengawas 2"><input className="input" value={f.nip2} onChange={(e) => set({ nip2: e.target.value })} /></Field>
            </div>
            {tab === 'hadir' ? (
              <label className="check"><input type="checkbox" checked={f.otomatis} onChange={(e) => set({ otomatis: e.target.checked })} /> Isi keterangan hadir/tidak hadir otomatis dari data login ujian (kosongkan untuk diisi manual)</label>
            ) : (
              <Field label="Catatan selama ujian">
                <textarea className="input" rows={3} value={f.catatan} onChange={(e) => set({ catatan: e.target.value })} placeholder="Kosongkan bila tidak ada kejadian khusus" />
                <button className="btn ghost sm mt" onClick={catatanOtomatis}>Isi otomatis dari data ujian</button>
              </Field>
            )}
            <div className="row small muted mt"><Users size={15} /> {list.length} peserta · hadir {hadir.length} · tidak hadir {absen.length}</div>
          </div>

          {list.length === 0 ? <div className="clay"><Empty text="Tidak ada peserta untuk filter ini" /></div> : (
            <div className="clay doc-wrap">
              {tab === 'hadir' ? (
                <div className="doc">
                  <Kop />
                  <div className="doc-title">Daftar Hadir Peserta Ujian<br /><span style={{ fontSize: 12, fontWeight: 600, textTransform: 'none' }}>{settings.judul_ujian} · Tahun Ajaran {settings.tahun_ajaran}</span></div>
                  <Identitas />
                  <table className="grid-t">
                    <thead><tr><th style={{ width: 34 }}>No</th><th style={{ width: 90 }}>NIS</th><th>Nama Peserta</th><th style={{ width: 80 }}>Kelas</th><th colSpan={2} style={{ width: 190 }}>Tanda Tangan</th><th style={{ width: 90 }}>Keterangan</th></tr></thead>
                    <tbody>
                      {list.map((s, i) => (
                        <tr key={s.id} style={{ height: 30 }}>
                          <td style={{ textAlign: 'center' }}>{i + 1}</td>
                          <td>{s.nis}</td>
                          <td>{s.nama}</td>
                          <td>{kelasMap[s.kelas_id]}</td>
                          <td style={{ width: 95, borderRight: 0 }}>{i % 2 === 0 ? `${i + 1}.` : ''}</td>
                          <td style={{ width: 95, borderLeft: 0 }}>{i % 2 === 1 ? `${i + 1}.` : ''}</td>
                          <td style={{ textAlign: 'center' }}>{f.otomatis ? (peserta[s.id] ? 'Hadir' : 'Tidak hadir') : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p style={{ marginTop: 8 }}>Jumlah peserta: {list.length} · Hadir: {f.otomatis ? hadir.length : '......'} · Tidak hadir: {f.otomatis ? absen.length : '......'}</p>
                  <TTD />
                </div>
              ) : (
                <div className="doc" style={{ fontSize: 13.5 }}>
                  <Kop />
                  <div className="doc-title">Berita Acara Pelaksanaan Ujian<br /><span style={{ fontSize: 12, fontWeight: 600, textTransform: 'none' }}>{settings.judul_ujian} · Tahun Ajaran {settings.tahun_ajaran}</span></div>
                  <p style={{ textAlign: 'justify' }}>
                    Pada hari ini <b>{f.tanggal}</b>, telah diselenggarakan <b>{ujian?.nama}</b> mata pelajaran <b>{mapel}</b> berbasis komputer (CBT)
                    di {settings.nama_sekolah}, mulai pukul <b>{f.mulai || '.......'}</b> sampai dengan pukul <b>{f.selesai || '.......'}</b>, dengan rincian:
                  </p>
                  <table className="info" style={{ margin: '10px 0 10px 18px' }}>
                    <tbody>
                      <tr><td style={{ width: 230 }}>1. Kelas</td><td>: {kelasLabel || '-'}</td></tr>
                      <tr><td>2. Ruang / Sesi</td><td>: {f.ruang || '.......'} / {f.sesi || '.......'}</td></tr>
                      <tr><td>3. Jumlah peserta seharusnya</td><td>: {list.length} orang</td></tr>
                      <tr><td>4. Jumlah peserta hadir</td><td>: {hadir.length} orang</td></tr>
                      <tr><td>5. Jumlah peserta tidak hadir</td><td>: {absen.length} orang</td></tr>
                      <tr><td style={{ verticalAlign: 'top' }}>6. Nama peserta tidak hadir</td>
                        <td>: {absen.length ? absen.map((s) => `${s.nama} (${s.nis})`).join(', ') : '-'}</td></tr>
                    </tbody>
                  </table>
                  <div style={{ border: '1px solid #333', padding: '8px 10px', minHeight: 110 }}>
                    <b>Catatan selama pelaksanaan ujian:</b>
                    <div style={{ whiteSpace: 'pre-line', marginTop: 4 }}>{f.catatan || '\n\n\n'}</div>
                  </div>
                  <p style={{ marginTop: 10 }}>Demikian berita acara ini dibuat dengan sesungguhnya untuk dapat dipergunakan sebagaimana mestinya.</p>
                  <TTD />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
