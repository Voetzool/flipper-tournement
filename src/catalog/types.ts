/** Compacte catalogus zoals scripts/catalog-transform.mjs hem maakt (korte sleutels = kleiner bestand). */
export interface CatalogRow {
  /** OPDB-id */
  i: string;
  /** naam */
  n: string;
  /** korte naam (bijv. "MM") */
  s?: string;
  /** gangbare naam */
  c?: string;
  /** index in `mfrs` */
  m?: number;
  /** jaar */
  y?: number;
  /** em / ss / me */
  t?: 'em' | 'ss' | 'me';
  /** display-type */
  d?: string;
  /** aantal spelers */
  p?: number;
  /** IPDB-id */
  ip?: number;
  /** afbeelding klein/middel, relatief t.o.v. `imgBase` */
  is?: string;
  im?: string;
  /** rulesheet-URL */
  r?: string;
  /** PinballPrimer-URL */
  pp?: string;
  /** zoekwoorden */
  k?: string;
}

export interface CatalogFile {
  v: 1;
  source: string;
  generatedAt: string;
  imgBase: string;
  mfrs: string[];
  e: CatalogRow[];
}

export interface CatalogMeta {
  version: string;
  count: number;
  generatedAt: string;
  bytes: number;
  gzipBytes: number;
}

/** Leesbare vorm van een catalogusregel. */
export interface CatalogMachine {
  opdbId: string;
  name: string;
  shortName?: string;
  manufacturer?: string;
  year?: number;
  kind?: 'em' | 'ss' | 'me';
  players?: number;
  ipdbId?: number;
  imageSmall?: string;
  imageMedium?: string;
  rulesheetUrl?: string;
  primerUrl?: string;
}
