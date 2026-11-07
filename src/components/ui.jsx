import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { X, Inbox, AlertTriangle } from 'lucide-react';
import { supabase, isConfigured } from '../lib/supabase';

/* ---------- Toast ---------- */
const ToastCtx = createContext(null);
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((msg, type = 'ok') => {
    const id = Math.random();
    setItems((s) => [...s, { id, msg, type }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), type === 'err' ? 5000 : 3000);
  }, []);
  const api = { ok: (m) => push(m, 'ok'), err: (m) => push(m?.message || String(m), 'err') };
  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="toasts">
        {items.map((t) => (
          <div key={t.id} className={`clay-sm toast ${t.type}`}>{t.msg}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

/* ---------- Modal ---------- */
export function Modal({ title, onClose, children, footer, size }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`clay modal ${size || ''}`}>
        <div className="row between mb">
          <h2>{title}</h2>
          <button className="btn ghost icon" onClick={onClose} aria-label="Tutup"><X size={18} /></button>
        </div>
        {children}
        {footer && <div className="row mt" style={{ justifyContent: 'flex-end' }}>{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- Confirm ---------- */
const ConfirmCtx = createContext(null);
export function ConfirmProvider({ children }) {
  const [st, setSt] = useState(null);
  const confirm = useCallback(
    (message, { title = 'Konfirmasi', okText = 'Ya, lanjutkan', danger = true } = {}) =>
      new Promise((resolve) => setSt({ message, title, okText, danger, resolve })),
    []
  );
  const close = (v) => { st?.resolve(v); setSt(null); };
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {st && (
        <Modal title={st.title} onClose={() => close(false)}
          footer={<>
            <button className="btn ghost" onClick={() => close(false)}>Batal</button>
            <button className={`btn ${st.danger ? 'red' : ''}`} onClick={() => close(true)}>{st.okText}</button>
          </>}>
          <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
            <div className="stat-ico tint-amber" style={{ width: 44, height: 44 }}><AlertTriangle size={22} /></div>
            <p style={{ whiteSpace: 'pre-line' }}>{st.message}</p>
          </div>
        </Modal>
      )}
    </ConfirmCtx.Provider>
  );
}
export const useConfirm = () => useContext(ConfirmCtx);

/* ---------- Misc ---------- */
export const Spinner = () => <div className="spinner" />;

export function Empty({ text = 'Belum ada data', icon: Icon = Inbox, children }) {
  return (
    <div className="empty">
      <div className="empty-ico clay-sm"><Icon size={30} color="#f0832a" /></div>
      <div className="bold">{text}</div>
      {children && <div className="mt">{children}</div>}
    </div>
  );
}

export function Field({ label, children, hint }) {
  return (
    <div className="field">
      {label && <label className="label">{label}</label>}
      {children}
      {hint && <div className="tiny muted" style={{ margin: '5px 4px 0' }}>{hint}</div>}
    </div>
  );
}

/* ---------- Pengaturan sekolah (global) ---------- */
const SettingsCtx = createContext(null);
export const DEFAULT_LOGO = '/logo.png';
const DEFAULTS = { nama_sekolah: "SMK Mamba'ul Ulum", kota: 'Mojokerto', tahun_ajaran: '2026/2027', semester: 'Ganjil' };
export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULTS);
  const reload = useCallback(async () => {
    if (!isConfigured) return;
    const { data } = await supabase.from('settings').select('*').eq('id', 1).maybeSingle();
    if (data) setSettings({ ...data, nama_sekolah: data.nama_sekolah || DEFAULTS.nama_sekolah });
  }, []);
  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    document.title = `CBT ${settings.nama_sekolah || 'SMK'}`;
    const link = document.querySelector("link[rel='icon']");
    if (link) link.href = settings.logo_url || '/icon-192.png';
  }, [settings]);
  return <SettingsCtx.Provider value={{ settings, reload, setSettings }}>{children}</SettingsCtx.Provider>;
}
export const useSettings = () => useContext(SettingsCtx);

export function SchoolLogo({ size = 46 }) {
  const { settings } = useSettings();
  return (
    <div className="brand-logo" style={{ width: size, height: size, boxShadow: 'var(--shadow-clay-sm)', background: '#fff', padding: size * 0.06 }}>
      <img src={settings.logo_url || DEFAULT_LOGO} alt="logo" />
    </div>
  );
}
