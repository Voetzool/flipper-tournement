import type { AppState, Id } from '../events/types';

/** Spelers van de vaste groep (niet gearchiveerd), op naam. */
export function corePlayerIds(s: AppState): Id[] {
  return [...s.players.values()]
    .filter((p) => p.core && !p.archived)
    .sort((a, b) => a.name.localeCompare(b.name, 'nl'))
    .map((p) => p.id);
}

/**
 * Knop "Vaste groep": zijn alle vaste spelers al gekozen, dan gaan ze er (alleen zij) weer uit;
 * anders worden ze erbij gezet. Andere gekozen spelers blijven staan.
 */
export function toggleCoreSelection(selected: readonly Id[], core: readonly Id[]): Id[] {
  const all = core.length > 0 && core.every((id) => selected.includes(id));
  if (all) return selected.filter((id) => !core.includes(id));
  return [...selected, ...core.filter((id) => !selected.includes(id))];
}
