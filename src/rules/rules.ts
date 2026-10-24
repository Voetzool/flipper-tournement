import { signal } from '@preact/signals';
import { dispatch, state } from '../app/state';
import { catalogIndex, loadStoredCatalog } from '../catalog/catalog';
import type { Machine, MachineRules } from '../events/types';
import { primerToMarkdown } from './primer';

// Spelregels worden bij het toevoegen van een kast automatisch opgehaald en als event opgeslagen
// (dus ook in back-ups en offline beschikbaar). Bronnen, in volgorde:
//  1. Pinball Rulesheets (pinballrulesheets.com, CC0) — meegeleverd met de app (same-origin, map rules/).
//  2. The Pinball Primer — de pagina wordt op dit apparaat opgehaald als persoonlijke offline kopie.

const RULES_BASE = import.meta.env.BASE_URL + 'rules/';
export const RULESHEETS_SITE = 'https://pinballrulesheets.com/';

/** Kasten waarvoor nu spelregels worden opgehaald (voor een laad-indicator). */
export const fetchingRules = signal<Set<string>>(new Set());

export async function fetchRules(m: Pick<Machine, 'rulesheetPath' | 'primerUrl'>): Promise<MachineRules | null> {
  if (m.rulesheetPath) {
    const res = await fetch(RULES_BASE + m.rulesheetPath + '.md');
    if (res.ok) {
      return { source: 'pinballrulesheets', url: RULESHEETS_SITE + m.rulesheetPath, text: await res.text(), fetchedAt: Date.now() };
    }
  }
  if (m.primerUrl && new URL(m.primerUrl).hostname === 'pinballprimer.github.io') {
    const res = await fetch(m.primerUrl, { mode: 'cors' });
    if (res.ok) {
      const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
      const text = primerToMarkdown(doc, m.primerUrl);
      if (text.length > 200) return { source: 'pinballprimer', url: m.primerUrl, text, fetchedAt: Date.now() };
    }
  }
  return null;
}

/** Vul ontbrekende bronnen (rulesheet/PinballPrimer) aan uit de catalogus, voor kasten van vóór deze functie. */
async function fillSourcesFromCatalog(m: Machine): Promise<Machine> {
  if (!m.opdbId || m.rulesheetPath || m.primerUrl) return m;
  await loadStoredCatalog();
  const index = catalogIndex.value;
  const row = index?.file.e.find((r) => r.i === m.opdbId);
  if (!row || (!row.rs && !row.pp)) return m;
  dispatch({ type: 'MachineUpdated', machineId: m.id, rulesheetPath: row.rs, primerUrl: row.pp });
  return { ...m, rulesheetPath: row.rs, primerUrl: row.pp };
}

/** Haalt spelregels op en slaat ze op. Geeft true als er (nieuwe) spelregels zijn opgeslagen. */
export async function ensureRules(machineId: string, force = false): Promise<boolean> {
  let m = state.value.machines.get(machineId);
  if (!m || (m.rules && !force) || fetchingRules.value.has(machineId)) return false;
  fetchingRules.value = new Set([...fetchingRules.value, machineId]);
  try {
    m = await fillSourcesFromCatalog(m);
    const rules = await fetchRules(m);
    if (!rules) return false;
    if (m.rules && m.rules.text === rules.text) return false;
    dispatch({ type: 'MachineUpdated', machineId, rules });
    return true;
  } catch {
    return false; // offline of bron niet bereikbaar: later opnieuw
  } finally {
    const next = new Set(fetchingRules.value);
    next.delete(machineId);
    fetchingRules.value = next;
  }
}

/** Probeer voor alle kasten zonder spelregels (maar met een bron) alsnog op te halen. */
export async function syncMissingRules() {
  if (!navigator.onLine) return;
  for (const m of state.value.machines.values()) {
    if (m.active && !m.rules && (m.rulesheetPath || m.primerUrl || m.opdbId)) await ensureRules(m.id);
  }
}
