import { useSettings, DEFAULT_LOGO } from './ui';

/** Kop surat sekolah untuk dokumen cetak */
export default function Kop() {
  const { settings: s } = useSettings();
  return (
    <div className="kop">
      <img src={s.logo_url || DEFAULT_LOGO} alt="" />
      <div className="kop-text">
        <div style={{ fontSize: 18, fontWeight: 900, textTransform: 'uppercase' }}>{s.nama_sekolah}</div>
        {s.npsn && <div style={{ fontSize: 11 }}>NPSN: {s.npsn}</div>}
        {s.alamat && <div style={{ fontSize: 11 }}>{s.alamat}{s.kota ? `, ${s.kota}` : ''}</div>}
        {(s.telepon || s.email) && <div style={{ fontSize: 11 }}>{[s.telepon && `Telp. ${s.telepon}`, s.email].filter(Boolean).join(' · ')}</div>}
      </div>
      <img src={s.logo_url || DEFAULT_LOGO} alt="" style={{ visibility: 'hidden' }} />
    </div>
  );
}

export const hariTanggal = (d) => (d ? new Date(d) : new Date()).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
export const jam = (d) => (d ? new Date(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '');
