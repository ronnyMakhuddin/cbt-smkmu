import katex from 'katex';

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function renderText(s) {
  let h = esc(s);
  // gambar: ![alt](url)
  h = h.replace(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g, (_, alt, src) => `<img src="${src}" alt="${alt}" loading="lazy" />`);
  h = h.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  h = h.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>');
  h = h.replace(/__([^_]+)__/g, '<u>$1</u>');
  return h.replace(/\n/g, '<br/>');
}

/**
 * Format konten soal:
 *  - Rumus inline  : $x^2$   | rumus blok: $$\frac{a}{b}$$
 *  - Gambar        : ![](https://...)
 *  - Tebal / miring: **tebal**  *miring*  __garis bawah__
 */
export function renderContent(src = '') {
  if (!src) return '';
  const parts = String(src).split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g);
  return parts
    .map((p) => {
      if (/^\$\$[\s\S]+\$\$$/.test(p)) return math(p.slice(2, -2), true);
      if (/^\$[^$\n]+\$$/.test(p)) return math(p.slice(1, -1), false);
      return renderText(p);
    })
    .join('');
}

function math(tex, display) {
  try {
    return katex.renderToString(tex, { displayMode: display, throwOnError: false, strict: false });
  } catch {
    return esc(tex);
  }
}

export function plainText(src = '') {
  return String(src)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '[gambar]')
    .replace(/\$\$?([^$]+)\$\$?/g, '$1')
    .replace(/[*_]{1,2}/g, '');
}
