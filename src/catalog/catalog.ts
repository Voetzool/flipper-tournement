import { computed, signal } from '@preact/signals';
import { getMeta, setMeta } from '../db/db';
import { buildIndex, type CatalogIndex } from './search';
import type { CatalogFile, CatalogMeta } from './types';

// De catalogus wordt NIET door de service worker vooraf gecachet (scheelt data bij elke update).
// Hij wordt pas gedownload als je hem nodig hebt en dan in IndexedDB bewaard, zodat zoeken offline werkt.

const BASE = import.meta.env.BASE_URL + 'catalog/';

export const catalog = signal<CatalogFile | null>(null);
export const catalogVersion = signal<string | null>(null);
export const catalogStatus = signal<'idle' | 'loading' | 'error'>('idle');
export const catalogError = signal<string>('');
export const catalogIndex = computed<CatalogIndex | null>(() => (catalog.value ? buildIndex(catalog.value) : null));

let loadedFromDb = false;

/** Laadt de lokaal opgeslagen catalogus (geen netwerk). */
export async function loadStoredCatalog() {
  if (loadedFromDb) return;
  loadedFromDb = true;
  const stored = await getMeta<{ version: string; file: CatalogFile }>('catalog');
  if (stored) {
    catalog.value = stored.file;
    catalogVersion.value = stored.version;
  }
}

/** Info over de catalogus op de server, of null als die niet bereikbaar is. */
export async function fetchRemoteMeta(): Promise<CatalogMeta | null> {
  try {
    const res = await fetch(BASE + 'opdb-meta.json', { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as CatalogMeta;
  } catch {
    return null;
  }
}

/** Download de catalogus als er een nieuwere versie is (of als `force`). */
export async function updateCatalog(force = false): Promise<boolean> {
  await loadStoredCatalog();
  catalogStatus.value = 'loading';
  catalogError.value = '';
  try {
    const meta = await fetchRemoteMeta();
    if (!meta) throw new Error(navigator.onLine ? 'De catalogus is (nog) niet beschikbaar.' : 'Geen internetverbinding.');
    if (!force && meta.version === catalogVersion.value) {
      catalogStatus.value = 'idle';
      return false;
    }
    const res = await fetch(BASE + 'opdb.json?v=' + meta.version);
    if (!res.ok) throw new Error('Downloaden mislukt.');
    const file = (await res.json()) as CatalogFile;
    await setMeta('catalog', { version: meta.version, file });
    catalog.value = file;
    catalogVersion.value = meta.version;
    catalogStatus.value = 'idle';
    return true;
  } catch (e) {
    catalogError.value = (e as Error).message;
    catalogStatus.value = 'error';
    return false;
  }
}

/** Zorgt dat afbeeldingen alvast in de cache komen (voor offline gebruik). */
export function prefetchImage(url?: string) {
  if (!url) return;
  const img = new Image();
  img.src = url;
}
