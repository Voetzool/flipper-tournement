// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
// @ts-expect-error: plain JS-module uit scripts/
import { parseRulesheet } from '../scripts/rules-transform.mjs';
// @ts-expect-error: plain JS-module uit scripts/
import { transformOpdb } from '../scripts/catalog-transform.mjs';
import { renderMarkdown } from '../src/rules/markdown';
import { primerToMarkdown } from '../src/rules/primer';

const BASE = 'https://pinballrulesheets.com/stern/jaws-rulesheet';

describe('rulesheet inlezen (Pinball Rulesheets)', () => {
  it('leest titel, OPDB-groep en tekst', () => {
    const r = parseRulesheet('---\ntitle: "Jaws Rulesheet"\nmanufacturer: "Stern"\nopdb_id: "GabcD"\n---\n\n# Jaws\n\nTekst\n');
    expect(r).toEqual({ title: 'Jaws Rulesheet', opdbGroup: 'GabcD', body: '# Jaws\n\nTekst\n' });
  });
  it('koppelt een volledige OPDB-id op groep', () => {
    expect(parseRulesheet('---\nopdb_id: "GabcD-MxyzW"\n---\nx').opdbGroup).toBe('GabcD');
  });
  it('slaat pagina’s zonder opdb_id over', () => {
    expect(parseRulesheet('---\ntitle: "Master List"\n---\n# Lijst')).toBeNull();
    expect(parseRulesheet('# geen kopregels')).toBeNull();
  });
  it('catalogus krijgt het rulesheet-pad voor alle varianten van de kast', () => {
    const e = (id: string, name: string) => ({ opdbId: id, opdbGroup: id.split('-')[0], name, entryType: 'alias', physicalMachine: true });
    const cat = transformOpdb({ entries: [e('GabcD-M1111-A1', 'Jaws (Pro)'), e('GabcD-M1111-A2', 'Jaws (Premium)'), e('Gzzzz-M2222', 'Ander')] }, { rulesIndex: { GabcD: { path: 'stern/jaws-rulesheet' } } });
    expect(cat.e.filter((r: { rs?: string }) => r.rs === 'stern/jaws-rulesheet')).toHaveLength(2);
    expect(cat.e.find((r: { n: string }) => r.n === 'Ander').rs).toBeUndefined();
  });
});

describe('Markdown-weergave', () => {
  it('kopjes, lijsten, vet en een inhoudsopgave', () => {
    const { html, toc } = renderMarkdown('# Titel\n\n## Overzicht\n\n- **Ramp:** 3 keer\n  - sub\n1. een\n\n### Detail\n\nTekst *schuin*.', BASE);
    expect(html).toContain('<h2 class="rules-title">Titel</h2>');
    expect(html).toContain('<h2 id="r-overzicht">Overzicht</h2>');
    expect(html).toContain('<li class="d0"><strong>Ramp:</strong> 3 keer</li>');
    expect(html).toContain('<li class="d1">sub</li>');
    expect(html).toContain('<ol><li class="d0">een</li></ol>');
    expect(html).toContain('<h3 id="r-detail">Detail</h3>');
    expect(html).toContain('<em>schuin</em>');
    expect(toc).toEqual([{ id: 'r-overzicht', text: 'Overzicht' }]);
  });

  it('maakt relatieve links absoluut en laat afbeeldingen weg', () => {
    const { html } = renderMarkdown('Zie [Fallout](/stern/fallout-rulesheet) ![playfield](pf.jpg)', BASE);
    expect(html).toContain('href="https://pinballrulesheets.com/stern/fallout-rulesheet"');
    expect(html).toContain('<em>[playfield]</em>');
    expect(html).not.toContain('<img');
  });

  it('eigen inhoudsopgave: links naar kopjes scrollen binnen de pagina', () => {
    const r = renderMarkdown('# Jaws\n\n- [Modes](#heading--modes)\n\n## Modes of Play: {#heading--modes}\n\nTekst', BASE);
    expect(r.html).toContain('<a class="anchor" data-anchor="a-heading--modes">Modes</a>');
    expect(r.html).toContain('<h2 id="a-heading--modes">Modes of Play</h2>');
    expect(r.html).not.toContain('href="#');
    expect(r.hasOwnToc).toBe(true);
  });

  it('verwijdert forum-opmaak ([details] e.d.)', () => {
    const { html } = renderMarkdown('[details="Secret skill shot"]\nSchiet het midden.\n[/details]', BASE);
    expect(html).toContain('<strong>Secret skill shot</strong>');
    expect(html).not.toContain('[/details]');
  });

  it('tabellen', () => {
    const { html } = renderMarkdown('|Mode|Punten|\n|---|---|\n|Shark|5M|', BASE);
    expect(html).toContain('<th>Mode</th>');
    expect(html).toContain('<td>5M</td>');
  });

  it('is veilig: geen ruwe HTML, scripts of javascript:-links', () => {
    const { html } = renderMarkdown('<script>alert(1)</script>\n<img src=x onerror=alert(1)>\n[klik](javascript:alert(1)) "quote" & <b>vet</b>', BASE);
    expect(html).not.toMatch(/<script|<img|onerror|javascript:|<b>/);
    expect(html).toContain('&quot;quote&quot; &amp; vet');
  });
});

describe('PinballPrimer-pagina omzetten', () => {
  it('neemt kopjes, alinea’s, lijsten en links over; geen scripts of plaatjes', () => {
    const html = `<html><head><style>h1{}</style><script>x()</script></head><body>
      <h1>Testkast (1990)</h1><img src="t.jpg">
      <h2>Quick strategy</h2><p>Schiet de <b>ramp</b>, zie <a href="other.html">andere</a>.</p>
      <ul><li>Eén<ul><li>Sub</li></ul></li><li>Twee</li></ul>
      <table><tr><td>Mode</td><td>Punten</td></tr><tr><td>A</td><td>1M</td></tr></table>
    </body></html>`;
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const md = primerToMarkdown(doc, 'https://pinballprimer.github.io/test_GaaaA.html');
    expect(md).toContain('# Testkast (1990)');
    expect(md).toContain('## Quick strategy');
    expect(md).toContain('Schiet de **ramp** , zie [andere](https://pinballprimer.github.io/other.html).');
    expect(md).toContain('- Eén\n  - Sub\n- Twee');
    expect(md).toContain('| Mode | Punten |');
    expect(md).not.toMatch(/x\(\)|t\.jpg|h1\{\}/);
    // en het resultaat is weer netjes weer te geven
    expect(renderMarkdown(md, 'https://pinballprimer.github.io/').html).toContain('<strong>ramp</strong>');
  });
});
