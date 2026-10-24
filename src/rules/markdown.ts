// Kleine, veilige Markdown-weergave voor spelregels (geen externe bibliotheek, kleine bundle).
// Alle tekst wordt eerst ge-escaped; we maken alleen zelf een handvol tags aan. Ruwe HTML wordt weggelaten.

export interface RenderedRules {
  html: string;
  /** Kopjes (niveau 2) voor de inhoudsopgave. */
  toc: { id: string; text: string }[];
  /** Heeft de tekst een eigen inhoudsopgave (links naar kopjes binnen de pagina)? */
  hasOwnToc: boolean;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function resolveUrl(url: string, base: string): string | null {
  try {
    const u = new URL(url, base);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

function inline(text: string, base: string): string {
  let s = esc(text);
  // Afbeeldingen: alleen de beschrijving (scheelt data, werkt offline)
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]*)(?:\s+&quot;[^&]*&quot;)?\)/g, (_m, alt) => (alt ? `<em>[${alt}]</em>` : ''));
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, (_m, t, u) => {
    // Link naar een kopje op dezelfde pagina: knop die erheen scrollt (een #-href zou de hash-router verstoren).
    if (u.startsWith('#')) return `<a class="anchor" data-anchor="${esc(anchorId(u.slice(1)))}">${t}</a>`;
    const href = resolveUrl(u.replace(/&amp;/g, '&'), base);
    return href ? `<a href="${esc(href)}" target="_blank" rel="noopener">${t}</a>` : t;
  });
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/__([^_]+)__/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*\w])\*([^*\s][^*]*)\*(?!\w)/g, '$1<em>$2</em>');
  return s;
}

const anchorId = (id: string) => 'a-' + id.replace(/[^\w-]/g, '');

function slug(text: string, used: Set<string>) {
  let id = 'r-' + text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  while (used.has(id)) id += '-';
  used.add(id);
  return id;
}

/** @param base URL waartegen relatieve links worden opgelost (de bronpagina). */
export function renderMarkdown(md: string, base: string): RenderedRules {
  const lines = md
    .replace(/\r\n?/g, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?[a-z][^>]*>/gi, '') // ruwe HTML weg, tekst blijft
    .replace(/\s*\{:[^}]*\}/g, '') // kramdown-opmaak zoals {: .class}
    // Forum-opmaak (BBCode) uit de Tilt Forums-tijd: [details="Titel"] → vetgedrukte titel, rest weg.
    .replace(/\[details=["“]?([^"\]”]*)["”]?\]/gi, '\n**$1**\n')
    .replace(/\[\/?(details|spoiler|quote|center|size|color|u|s)(=[^\]]*)?\]/gi, '')
    .split('\n');
  // Eén enkel #-kopje is de titel; dan worden ##-kopjes de hoofdstukken.
  const h1Count = lines.filter((l) => /^#\s/.test(l.trim())).length;
  const shift = h1Count <= 1 ? 0 : 1;
  let hasOwnToc = false;
  const out: string[] = [];
  const toc: RenderedRules['toc'] = [];
  const used = new Set<string>();
  let para: string[] = [];
  let list: { type: 'ul' | 'ol'; items: { depth: number; text: string }[] } | null = null;
  let table: string[][] = [];
  let quote: string[] = [];

  const flushPara = () => {
    if (para.length) out.push(`<p>${inline(para.join(' '), base)}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list) {
      const items = list.items.map((i) => `<li class="d${Math.min(i.depth, 3)}">${inline(i.text, base)}</li>`).join('');
      out.push(`<${list.type}>${items}</${list.type}>`);
    }
    list = null;
  };
  const flushTable = () => {
    if (table.length) {
      const [head, ...rows] = table;
      const cells = (r: string[], tag: string) => r.map((c) => `<${tag}>${inline(c, base)}</${tag}>`).join('');
      out.push(
        `<div class="table-wrap"><table><thead><tr>${cells(head, 'th')}</tr></thead><tbody>${rows.map((r) => `<tr>${cells(r, 'td')}</tr>`).join('')}</tbody></table></div>`,
      );
    }
    table = [];
  };
  const flushQuote = () => {
    if (quote.length) out.push(`<blockquote>${inline(quote.join(' '), base)}</blockquote>`);
    quote = [];
  };
  const flushAll = () => {
    flushPara();
    flushList();
    flushTable();
    flushQuote();
  };

  for (const raw of lines) {
    const line = raw.replace(/\t/g, '    ');
    const t = line.trim();
    let m: RegExpExecArray | null;
    if (!t) {
      flushAll();
    } else if ((m = /^(#{1,6})\s+(.*?)\s*#*$/.exec(t))) {
      flushAll();
      const own = /\s*\{#([^}]+)\}\s*$/.exec(m[2]); // kramdown-anker, bijv. {#heading--modes}
      const text = m[2].replace(/\s*\{#[^}]*\}\s*$/, '').replace(/\*\*/g, '').replace(/:$/, '');
      if (!text) continue;
      if (m[1].length === 1 && shift === 0) {
        out.push(`<h2 class="rules-title"${own ? ` id="${esc(anchorId(own[1]))}"` : ''}>${inline(text, base)}</h2>`);
        continue;
      }
      const level = Math.min(4, Math.max(2, m[1].length + shift)); // ## → h2 (de paginatitel is al h1)
      const id = own ? anchorId(own[1]) : slug(text, used);
      if (level === 2) toc.push({ id, text });
      out.push(`<h${level} id="${esc(id)}">${inline(text, base)}</h${level}>`);
    } else if (/^(-{3,}|\*{3,}|_{3,})$/.test(t)) {
      flushAll();
      out.push('<hr>');
    } else if (t.startsWith('|')) {
      flushPara();
      flushList();
      flushQuote();
      if (/^\|?\s*:?-{2,}/.test(t)) continue; // scheidingsregel
      table.push(t.replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
    } else if ((m = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line))) {
      flushPara();
      flushTable();
      flushQuote();
      const type = /\d/.test(m[2]) ? 'ol' : 'ul';
      const depth = Math.floor(m[1].length / 2);
      if (!list || (depth === 0 && list.type !== type)) {
        flushList();
        list = { type, items: [] };
      }
      list.items.push({ depth, text: m[3] });
    } else if (t.startsWith('>')) {
      flushPara();
      flushList();
      flushTable();
      quote.push(t.replace(/^>\s?/, ''));
    } else if (list && /^\s{2,}/.test(line)) {
      // vervolgregel van een lijstitem
      list.items[list.items.length - 1].text += ' ' + t;
    } else {
      flushList();
      flushTable();
      flushQuote();
      para.push(t);
    }
  }
  flushAll();
  const html = out.join('\n');
  hasOwnToc = html.includes('data-anchor=');
  return { html, toc, hasOwnToc };
}
