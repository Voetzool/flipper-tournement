// Zet een handleiding-pagina van The Pinball Primer (HTML) om naar Markdown, zodat we hem offline
// in dezelfde stijl kunnen tonen. Draait op het apparaat van de gebruiker (persoonlijke kopie).

const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'IMG', 'PICTURE', 'SVG', 'IFRAME', 'VIDEO', 'NAV', 'HEADER', 'FOOTER', 'FORM', 'BUTTON']);

function text(node: Node, base: string): string {
  if (node.nodeType === 3) return (node.textContent ?? '').replace(/\s+/g, ' ');
  if (node.nodeType !== 1) return '';
  const el = node as Element;
  if (SKIP.has(el.tagName)) return '';
  const inner = () => Array.from(el.childNodes).map((c) => text(c, base)).join('');
  switch (el.tagName) {
    case 'B':
    case 'STRONG': {
      const t = inner().trim();
      return t ? `**${t}** ` : '';
    }
    case 'I':
    case 'EM': {
      const t = inner().trim();
      return t ? `*${t}* ` : '';
    }
    case 'BR':
      return ' ';
    case 'A': {
      const t = inner().trim();
      const href = el.getAttribute('href');
      if (!t) return '';
      if (!href || href.startsWith('#')) return t;
      try {
        return `[${t}](${new URL(href, base).href})`;
      } catch {
        return t;
      }
    }
    default:
      return inner();
  }
}

function blocks(el: Element, base: string, out: string[], depth = 0) {
  for (const child of Array.from(el.children)) {
    if (SKIP.has(child.tagName)) continue;
    const tag = child.tagName;
    if (/^H[1-6]$/.test(tag)) {
      const t = text(child, base).trim();
      if (t) out.push(`${'#'.repeat(Number(tag[1]))} ${t}`, '');
    } else if (tag === 'P' || tag === 'BLOCKQUOTE') {
      const t = text(child, base).trim();
      if (t) out.push((tag === 'BLOCKQUOTE' ? '> ' : '') + t, '');
    } else if (tag === 'UL' || tag === 'OL') {
      Array.from(child.children).forEach((li, i) => {
        if (li.tagName !== 'LI') return;
        // tekst van het item zonder geneste lijsten
        const own = Array.from(li.childNodes)
          .filter((n) => !(n.nodeType === 1 && ['UL', 'OL'].includes((n as Element).tagName)))
          .map((n) => text(n, base))
          .join('')
          .trim();
        if (own) out.push(`${'  '.repeat(depth)}${tag === 'OL' ? i + 1 + '.' : '-'} ${own}`);
        for (const sub of Array.from(li.children)) if (sub.tagName === 'UL' || sub.tagName === 'OL') blocks(li, base, out, depth + 1);
      });
      if (depth === 0) out.push('');
    } else if (tag === 'TABLE') {
      const rows = Array.from(child.querySelectorAll('tr')).map((tr) =>
        Array.from(tr.children).map((c) => text(c, base).trim().replace(/\|/g, '/')),
      );
      if (rows.length) {
        out.push('| ' + rows[0].join(' | ') + ' |', '|' + rows[0].map(() => '---').join('|') + '|');
        for (const r of rows.slice(1)) out.push('| ' + r.join(' | ') + ' |');
        out.push('');
      }
    } else if (tag === 'HR') {
      out.push('---', '');
    } else if (child.children.length) {
      blocks(child, base, out, depth);
    } else {
      const t = text(child, base).trim();
      if (t) out.push(t, '');
    }
  }
}

export function primerToMarkdown(doc: Document, pageUrl: string): string {
  const out: string[] = [];
  blocks(doc.body, pageUrl, out);
  return out
    .join('\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
