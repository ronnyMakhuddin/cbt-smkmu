import { useRef, useState } from 'react';
import { Bold, Italic, Underline, ImagePlus, Sigma, Eye, EyeOff, Loader2 } from 'lucide-react';
import RichText from './RichText';
import { uploadImage } from '../lib/upload';
import { useToast } from './ui';

const FORMULAS = [
  ['a/b', '\\frac{a}{b}'],
  ['x²', 'x^{2}'],
  ['xₙ', 'x_{n}'],
  ['√x', '\\sqrt{x}'],
  ['ⁿ√x', '\\sqrt[n]{x}'],
  ['×', '\\times'],
  ['÷', '\\div'],
  ['±', '\\pm'],
  ['≤', '\\le'],
  ['≥', '\\ge'],
  ['≠', '\\neq'],
  ['≈', '\\approx'],
  ['π', '\\pi'],
  ['α', '\\alpha'],
  ['β', '\\beta'],
  ['θ', '\\theta'],
  ['Δ', '\\Delta'],
  ['Ω', '\\Omega'],
  ['μ', '\\mu'],
  ['∞', '\\infty'],
  ['°', '^{\\circ}'],
  ['Σ', '\\sum_{i=1}^{n} x_i'],
  ['∫', '\\int_{a}^{b} f(x)\\,dx'],
  ['lim', '\\lim_{x \\to 0}'],
  ['log', '\\log_{a} b'],
  ['sin', '\\sin \\theta'],
  ['vektor', '\\vec{v}'],
  ['matriks', '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}'],
  ['→', '\\rightarrow'],
  ['⇌', '\\rightleftharpoons'],
  ['H₂O', '\\mathrm{H_2O}'],
  ['Ω (R)', 'R = \\frac{V}{I}\\,\\Omega'],
];

/**
 * Editor teks soal dengan dukungan gambar (upload / tempel) dan rumus (LaTeX/KaTeX).
 */
export default function RichEditor({ value, onChange, rows = 4, placeholder, compact }) {
  const ta = useRef(null);
  const file = useRef(null);
  const toast = useToast();
  const [showF, setShowF] = useState(false);
  const [preview, setPreview] = useState(!compact);
  const [busy, setBusy] = useState(false);

  const insert = (before, after = '', fallback = '') => {
    const el = ta.current;
    const s = el.selectionStart ?? value.length;
    const e = el.selectionEnd ?? value.length;
    const sel = value.slice(s, e) || fallback;
    const next = value.slice(0, s) + before + sel + after + value.slice(e);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = s + before.length + sel.length + after.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const doUpload = async (f) => {
    if (!f) return;
    setBusy(true);
    try {
      const url = await uploadImage(f);
      insert(`\n![gambar](${url})\n`);
      toast.ok('Gambar terunggah');
    } catch (e) {
      toast.err(e);
    } finally {
      setBusy(false);
    }
  };

  const onPaste = (e) => {
    const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
    if (item) {
      e.preventDefault();
      doUpload(item.getAsFile());
    }
  };

  return (
    <div>
      <div className="toolbar">
        <button type="button" className="tbtn" title="Tebal" onClick={() => insert('**', '**', 'teks')}><Bold size={14} /></button>
        <button type="button" className="tbtn" title="Miring" onClick={() => insert('*', '*', 'teks')}><Italic size={14} /></button>
        <button type="button" className="tbtn" title="Garis bawah" onClick={() => insert('__', '__', 'teks')}><Underline size={14} /></button>
        <button type="button" className="tbtn" onClick={() => file.current.click()} disabled={busy}>
          {busy ? <Loader2 size={14} className="spin" /> : <ImagePlus size={14} />} Gambar
        </button>
        <button type="button" className="tbtn" onClick={() => setShowF((v) => !v)}><Sigma size={14} /> Rumus</button>
        <button type="button" className="tbtn" onClick={() => setPreview((v) => !v)}>
          {preview ? <EyeOff size={14} /> : <Eye size={14} />} Pratinjau
        </button>
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { doUpload(e.target.files[0]); e.target.value = ''; }} />
      </div>
      {showF && (
        <div className="clay-in mb" style={{ padding: 10 }}>
          <div className="formula-grid">
            {FORMULAS.map(([l, tex]) => (
              <button type="button" key={l} className="tbtn" style={{ justifyContent: 'center' }} onClick={() => insert('$' + tex + '$')}>{l}</button>
            ))}
          </div>
          <div className="tiny muted">
            Tulis rumus di antara tanda <b>$...$</b> (sebaris) atau <b>$$...$$</b> (baris sendiri), format LaTeX. Contoh: <code>$\frac{'{1}{2}'}mv^2$</code>
          </div>
        </div>
      )}
      <textarea
        ref={ta}
        className="input"
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onPaste={onPaste}
        style={compact ? { minHeight: 52 } : undefined}
      />
      {preview && value && (
        <div className="preview-box"><RichText value={value} /></div>
      )}
    </div>
  );
}
