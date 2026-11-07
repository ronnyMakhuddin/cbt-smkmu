export default function SetupNotice() {
  return (
    <div className="auth-wrap">
      <div className="clay" style={{ maxWidth: 560 }}>
        <h1>Konfigurasi belum lengkap</h1>
        <p className="muted mt">
          Aplikasi belum terhubung ke Supabase. Isi environment variable berikut di Vercel
          (Project Settings → Environment Variables) atau di file <code>.env</code> lalu deploy ulang:
        </p>
        <pre className="clay-in mt" style={{ whiteSpace: 'pre-wrap' }}>
{`VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...`}
        </pre>
        <p className="small muted mt">Panduan lengkap ada di README.md pada repository.</p>
      </div>
    </div>
  );
}
