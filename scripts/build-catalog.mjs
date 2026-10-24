// Haalt de OPDB-export op (gratis, zonder token, via het CDN van Match Play) en schrijft een compacte
// catalogus naar public/catalog/. Draait in GitHub Actions vóór de build.
// Mislukt het downloaden, dan gaat de build gewoon door zonder (nieuwe) catalogus.
//
// Gebruik: node scripts/build-catalog.mjs            (downloaden)
//          node scripts/build-catalog.mjs export.json (lokaal bestand gebruiken)
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { transformOpdb } from './catalog-transform.mjs';

const URL = process.env.OPDB_EXPORT_URL ?? 'https://mp-data.sfo3.cdn.digitaloceanspaces.com/opdb-v2.json';
const outDir = new globalThis.URL('../public/catalog/', import.meta.url);

async function load() {
  const file = process.argv[2];
  if (file) return JSON.parse(readFileSync(file, 'utf8'));
  const res = await fetch(URL, { headers: { 'User-Agent': 'flipper-toernooi-build' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} bij ${URL}`);
  return res.json();
}

try {
  const data = await load();
  const catalog = transformOpdb(data, { generatedAt: new Date().toISOString() });
  if (catalog.e.length < 100) throw new Error(`Verdacht weinig kasten in export (${catalog.e.length})`);
  const json = JSON.stringify(catalog);
  const version = createHash('sha256').update(json).digest('hex').slice(0, 12);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(new globalThis.URL('opdb.json', outDir), json);
  const meta = { version, count: catalog.e.length, generatedAt: catalog.generatedAt, bytes: json.length, gzipBytes: gzipSync(json).length };
  writeFileSync(new globalThis.URL('opdb-meta.json', outDir), JSON.stringify(meta));
  console.log(`Catalogus: ${meta.count} kasten, ${catalog.mfrs.length} fabrikanten, ${(meta.bytes / 1024).toFixed(0)} KB (gzip ${(meta.gzipBytes / 1024).toFixed(0)} KB), versie ${version}`);
  console.log('Afbeeldingen-basis:', catalog.imgBase || '(geen)');
  console.log('Voorbeeld:', JSON.stringify(catalog.e.find((r) => /medieval madness/i.test(r.n)) ?? catalog.e[0]));
} catch (err) {
  console.warn('::warning::Kastencatalogus niet bijgewerkt:', err.message);
}
