import type { CatalogFile, CatalogMachine, CatalogRow } from './types';

/** Kleine letters, zonder accenten en leestekens: "Attack From Mars!" → "attack from mars". */
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function toMachine(f: CatalogFile, r: CatalogRow): CatalogMachine {
  return {
    opdbId: r.i,
    name: r.n,
    shortName: r.s,
    manufacturer: r.m !== undefined ? f.mfrs[r.m] : undefined,
    year: r.y,
    kind: r.t,
    players: r.p,
    ipdbId: r.ip,
    imageSmall: r.is ? f.imgBase + r.is : undefined,
    imageMedium: r.im ? f.imgBase + r.im : undefined,
    rulesheetUrl: r.r,
    primerUrl: r.pp,
    rulesheetPath: r.rs,
    playfieldMedium: r.pm ? f.imgBase + r.pm : undefined,
    playfieldLarge: r.pl ? f.imgBase + r.pl : undefined,
  };
}

export interface CatalogIndex {
  file: CatalogFile;
  /** per regel: genormaliseerde zoektekst */
  text: string[];
  names: string[];
}

export function buildIndex(file: CatalogFile): CatalogIndex {
  const names = file.e.map((r) => normalize(r.n));
  const text = file.e.map(
    (r, i) => `${names[i]} ${normalize(r.s ?? '')} ${normalize(r.c ?? '')} ${normalize(r.m !== undefined ? file.mfrs[r.m] : '')} ${r.y ?? ''} ${normalize(r.k ?? '')}`,
  );
  return { file, text, names };
}

/**
 * Zoeken op (een deel van) naam, korte naam ("MM", "AFM"), fabrikant of jaar.
 * Alle woorden moeten voorkomen. Volgorde: exacte naam/korte naam, naam begint ermee, woord begint ermee, rest.
 */
export function searchCatalog(index: CatalogIndex, query: string, limit = 30): CatalogMachine[] {
  const q = normalize(query);
  if (!q) return [];
  const words = q.split(' ');
  const scored: { i: number; score: number }[] = [];
  for (let i = 0; i < index.text.length; i++) {
    const t = index.text[i];
    if (!words.every((w) => t.includes(w))) continue;
    const name = index.names[i];
    const row = index.file.e[i];
    let score = 0;
    if (name === q || normalize(row.s ?? '') === q) score += 100;
    if (name.startsWith(q)) score += 50;
    if ((' ' + name).includes(' ' + words[0])) score += 20;
    if (words.every((w) => (' ' + t).includes(' ' + w))) score += 10;
    // Nieuwere en "gewone" kasten iets hoger
    score += (row.y ?? 1950) / 1000;
    scored.push({ i, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => toMachine(index.file, index.file.e[x.i]));
}
