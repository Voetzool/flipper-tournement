// Zet de OPDB v2-export (van Match Play) om naar een compacte catalogus voor de app.
// Puur JavaScript zodat zowel het build-script (Node) als de tests (Vitest) het kunnen gebruiken.
// Formaat: zie src/catalog/types.ts (CatalogFile).

/** Grootste gemeenschappelijke begin van een lijst URL's, afgekapt op een '/'. */
export function commonPrefix(urls) {
  if (!urls.length) return '';
  let p = urls[0];
  for (const u of urls) {
    let i = 0;
    while (i < p.length && i < u.length && p[i] === u[i]) i++;
    p = p.slice(0, i);
    if (!p) return '';
  }
  return p.slice(0, p.lastIndexOf('/') + 1);
}

function pickImage(images) {
  if (!Array.isArray(images) || !images.length) return null;
  const order = ['backglass', 'cabinet', 'playfield', 'other', 'closeup'];
  const sorted = images
    .filter((i) => i && i.urls && i.urls.medium)
    .sort((a, b) => (b.primary ? 1 : 0) - (a.primary ? 1 : 0) || order.indexOf(a.type) - order.indexOf(b.type));
  return sorted[0] ?? null;
}

/**
 * @param {{entries: any[]}} data  OPDB v2-export
 * @param {{generatedAt?: string, source?: string}} meta
 */
export function transformOpdb(data, meta = {}) {
  const entries = Array.isArray(data?.entries) ? data.entries : Array.isArray(data) ? data : [];
  const mfrs = [];
  const mfrIndex = new Map();
  const rows = [];
  for (const e of entries) {
    if (!e || typeof e.opdbId !== 'string' || typeof e.name !== 'string') continue;
    // Alleen echte kasten en varianten (bijv. Premium/LE); groepen en virtuele tafels niet.
    if (e.entryType === 'machineGroup') continue;
    if (e.physicalMachine === false) continue;
    const mname = e.manufacturer?.name ?? null;
    let m = -1;
    if (mname) {
      if (!mfrIndex.has(mname)) {
        mfrIndex.set(mname, mfrs.length);
        mfrs.push(mname);
      }
      m = mfrIndex.get(mname);
    }
    const img = pickImage(e.images);
    const row = { i: e.opdbId, n: e.name };
    if (e.shortName && e.shortName !== e.name) row.s = e.shortName;
    if (e.commonName && e.commonName !== e.name) row.c = e.commonName;
    if (m >= 0) row.m = m;
    if (Number.isInteger(e.year)) row.y = e.year;
    if (e.type) row.t = e.type;
    if (e.display) row.d = e.display;
    if (Number.isInteger(e.playerCount)) row.p = e.playerCount;
    if (Number.isInteger(e.ipdbId)) row.ip = e.ipdbId;
    if (img) {
      row.is = img.urls.small;
      row.im = img.urls.medium;
    }
    if (e.pinballRulesUrl) row.r = e.pinballRulesUrl;
    if (e.pinballPrimerUrl) row.pp = e.pinballPrimerUrl;
    if (Array.isArray(e.keywords) && e.keywords.length) row.k = e.keywords.join(' ');
    rows.push(row);
  }
  // Afbeeldings-URL's delen bijna altijd hetzelfde begin; dat één keer opslaan scheelt veel bytes.
  const imgBase = commonPrefix(rows.flatMap((r) => [r.is, r.im].filter(Boolean)));
  if (imgBase) {
    for (const r of rows) {
      if (r.is) r.is = r.is.slice(imgBase.length);
      if (r.im) r.im = r.im.slice(imgBase.length);
    }
  }
  rows.sort((a, b) => a.n.localeCompare(b.n) || (a.y ?? 0) - (b.y ?? 0));
  return {
    v: 1,
    source: meta.source ?? 'OPDB (opdb.org) via Match Play',
    generatedAt: meta.generatedAt ?? new Date().toISOString(),
    imgBase,
    mfrs,
    e: rows,
  };
}
