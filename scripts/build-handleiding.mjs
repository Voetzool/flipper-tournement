// Zet de Pi-handleiding om naar losse webpagina's voor GitHub Pages:
//   server/HANDLEIDING.md (Nederlands) → dist/pi/index.html
//   server/MANUAL.md      (Engels)     → dist/pi/en/index.html
// Kleine eigen Markdown-omzetting voor precies wat de handleiding gebruikt: kopjes, alinea's, lijsten (ook genest),
// tabellen, codeblokken (met kopieerknop), citaten, vet, `code` en links. Alle tekst wordt ge-escaped.
//
// Gebruik: node scripts/build-handleiding.mjs [uitvoermap, standaard dist/pi]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const outDir = process.argv[2] ?? new URL('../dist/pi', import.meta.url).pathname;

const LANGS = {
  nl: { src: 'HANDLEIDING.md', out: 'index.html', root: '../', toc: 'Inhoud', copy: 'Kopiëren', copied: 'Gekopieerd!', back: '← Naar de app' },
  en: { src: 'MANUAL.md', out: 'en/index.html', root: '../../', toc: 'Contents', copy: 'Copy', copied: 'Copied!', back: '← Back to the app' },
};

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function inline(text) {
  const codes = [];
  let s = esc(text).replace(/`([^`]+)`/g, (_, c) => `\u0000${codes.push(c) - 1}\u0000`);
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>');
  s = s.replace(/(^|[\s(>])(https?:\/\/[^\s<)*]+[^\s<)*.,])/g, '$1<a href="$2">$2</a>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[i]}</code>`);
}

function slug(text, used) {
  let base = text.toLowerCase().replace(/<[^>]+>/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'kop';
  let id = base;
  for (let i = 2; used.has(id); i++) id = `${base}-${i}`;
  used.add(id);
  return id;
}

export function markdownToHtml(md, copyLabel = 'Kopiëren') {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const html = [];
  const toc = [];
  const used = new Set();
  let title = '';
  let para = [];
  let list = []; // { depth, ordered, text }
  let table = [];
  let quote = [];

  const flushPara = () => {
    if (para.length) html.push(`<p>${inline(para.join(' '))}</p>`);
    para = [];
  };
  const flushList = () => {
    if (!list.length) return;
    // Geneste lijsten opbouwen op basis van inspringing.
    const stack = [];
    let s = '';
    for (const item of list) {
      while (stack.length && stack[stack.length - 1].depth > item.depth) s += `</li></${stack.pop().tag}>`;
      const top = stack[stack.length - 1];
      if (!top || top.depth < item.depth) {
        const tag = item.ordered ? 'ol' : 'ul';
        s += `<${tag}>`;
        stack.push({ depth: item.depth, tag });
      } else {
        s += '</li>';
      }
      s += `<li>${inline(item.text)}`;
    }
    while (stack.length) s += `</li></${stack.pop().tag}>`;
    html.push(s);
    list = [];
  };
  const flushTable = () => {
    if (table.length) {
      const [head, ...rows] = table;
      const cells = (r, tag) => r.map((c) => `<${tag}>${inline(c)}</${tag}>`).join('');
      html.push(`<div class="table-wrap"><table><thead><tr>${cells(head, 'th')}</tr></thead><tbody>${rows.map((r) => `<tr>${cells(r, 'td')}</tr>`).join('')}</tbody></table></div>`);
    }
    table = [];
  };
  const flushQuote = () => {
    if (quote.length) html.push(`<div class="tip">${inline(quote.join(' '))}</div>`);
    quote = [];
  };
  const flushAll = () => (flushPara(), flushList(), flushTable(), flushQuote());

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();
    let m;
    if (t.startsWith('```')) {
      flushAll();
      const code = [];
      while (++i < lines.length && !lines[i].trim().startsWith('```')) code.push(lines[i]);
      html.push(`<div class="code"><pre><code>${esc(code.join('\n'))}</code></pre><button type="button" class="copy">${copyLabel}</button></div>`);
    } else if (!t) {
      flushAll();
    } else if ((m = /^(#{1,6})\s+(.*)$/.exec(t))) {
      flushAll();
      if (m[1].length === 1) {
        title = m[2];
        continue;
      }
      const id = slug(m[2], used);
      if (m[1].length === 2) toc.push({ id, text: m[2] });
      html.push(`<h${m[1].length} id="${id}">${inline(m[2])}</h${m[1].length}>`);
    } else if (t.startsWith('|')) {
      flushPara();
      flushList();
      if (/^\|?\s*:?-{3,}/.test(t)) continue;
      table.push(t.replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
    } else if ((m = /^(\s*)([-*]|\d+\.)\s+(.*)$/.exec(line))) {
      flushPara();
      flushTable();
      list.push({ depth: Math.floor(m[1].length / 2), ordered: /\d/.test(m[2]), text: m[3] });
    } else if (t.startsWith('>')) {
      flushPara();
      flushList();
      quote.push(t.replace(/^>\s?/, ''));
    } else if (list.length && /^\s{2,}/.test(line)) {
      list[list.length - 1].text += ' ' + t;
    } else {
      flushList();
      flushTable();
      para.push(t);
    }
  }
  flushAll();
  return { title, toc, body: html.join('\n') };
}

for (const [lang, L] of Object.entries(LANGS)) {
const { title, toc, body } = markdownToHtml(readFileSync(new URL('../server/' + L.src, import.meta.url), 'utf8'), L.copy);
const switcher = Object.keys(LANGS)
  .map((l) => (l === lang ? `<strong>${l === 'nl' ? 'Nederlands' : 'English'}</strong>` : `<a href="${L.root}pi/${LANGS[l].out.replace('index.html', '')}">${l === 'nl' ? 'Nederlands' : 'English'}</a>`))
  .join(' · ');

const page = `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link rel="icon" href="${L.root}icons/icon.svg">
<style>
:root { --bg:#f5f6fa; --card:#fff; --text:#1a1a2e; --muted:#5b5f73; --line:#dfe2ec; --accent:#0b7390; --code-bg:#1b1b2e; --code-text:#e8e8f2; --tip:#fff7d6; --tip-line:#e0b400; }
@media (prefers-color-scheme: dark) { :root { --bg:#0b0b12; --card:#1b1b2e; --text:#ececf4; --muted:#a3a6bd; --line:#2d2d45; --accent:#22e4ff; --code-bg:#05050a; --tip:#2a2610; --tip-line:#ffd60a; } }
* { box-sizing:border-box; }
body { margin:0; background:var(--bg); color:var(--text); font:17px/1.55 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif; }
main { max-width:760px; margin:0 auto; padding:24px 16px 64px; }
header { display:flex; align-items:center; gap:12px; margin-bottom:8px; }
header img { width:44px; height:44px; }
h1 { font-size:28px; line-height:1.2; margin:0; }
h2 { font-size:22px; margin:40px 0 12px; padding-top:12px; border-top:1px solid var(--line); }
h3 { font-size:18px; margin:24px 0 8px; }
a { color:var(--accent); }
code { font-family:ui-monospace,Menlo,Consolas,monospace; font-size:.92em; background:var(--line); padding:1px 5px; border-radius:5px; overflow-wrap:anywhere; }
.code { position:relative; margin:12px 0 16px; }
.code pre { margin:0; background:var(--code-bg); color:var(--code-text); padding:14px 14px 48px; border-radius:12px; overflow-x:auto; }
.code pre code { background:none; padding:0; font-size:15px; white-space:pre-wrap; word-break:break-all; }
.copy { position:absolute; right:8px; bottom:8px; border:0; border-radius:8px; padding:8px 14px; font:600 15px system-ui,sans-serif; background:var(--accent); color:#fff; cursor:pointer; }
.copy.done { background:#0d8a46; }
.table-wrap { overflow-x:auto; margin:12px 0; }
table { border-collapse:collapse; width:100%; background:var(--card); border-radius:12px; overflow:hidden; font-size:15px; }
th, td { text-align:left; vertical-align:top; padding:10px 12px; border-bottom:1px solid var(--line); }
th { background:var(--line); }
.tip { background:var(--tip); border-left:4px solid var(--tip-line); padding:10px 14px; border-radius:8px; margin:12px 0; }
nav.toc { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:12px 16px; margin:20px 0; }
nav.toc ol { margin:6px 0 0; padding-left:22px; }
li { margin:4px 0; }
.back { display:inline-block; margin-top:32px; }
.lang { text-align:right; font-size:15px; margin-bottom:8px; }
</style>
</head>
<body>
<main>
<div class="lang">${switcher}</div>
<header><img src="${L.root}icons/icon.svg" alt=""><h1>${inline(title)}</h1></header>
<nav class="toc"><strong>${L.toc}</strong><ol>${toc.map((h) => `<li><a href="#${h.id}">${inline(h.text)}</a></li>`).join('')}</ol></nav>
${body}
<a class="back" href="${L.root}">${L.back}</a>
</main>
<script>
document.querySelectorAll('.copy').forEach(function (b) {
  b.addEventListener('click', function () {
    var text = b.parentNode.querySelector('code').textContent;
    var done = function () { b.textContent = '${L.copied}'; b.classList.add('done'); setTimeout(function () { b.textContent = '${L.copy}'; b.classList.remove('done'); }, 2000); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done);
    else { var t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); done(); }
  });
});
</script>
</body>
</html>
`;

const out = join(outDir, L.out);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, page);
console.log('Handleiding geschreven naar', out);
}
