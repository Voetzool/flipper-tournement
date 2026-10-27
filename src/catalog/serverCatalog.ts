import { catalogError, catalogStatus } from './catalog';

/** Pi-versie: laat de server de nieuwste catalogus van internet halen. false (met melding) als dat niet lukt. */
export async function updateServerCatalog(): Promise<boolean> {
  catalogStatus.value = 'loading';
  catalogError.value = '';
  try {
    const res = await fetch('/api/catalog/update', { method: 'POST' });
    if (res.ok) return true;
    catalogError.value = ((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? 'Downloaden mislukt.';
  } catch {
    catalogError.value = 'Server niet bereikbaar.';
  }
  catalogStatus.value = 'error';
  return false;
}
