import type { Id } from '../../events/types';

/** Aantal rondes: n−1 bij een even aantal spelers, n bij oneven (dan is elke ronde iemand vrij). */
export function roundCount(players: number): number {
  if (players < 2) return 0;
  return players % 2 === 0 ? players - 1 : players;
}

/**
 * Ronde `r` (0-based) van het round-robin-schema volgens de cirkelmethode: de eerste plek staat vast,
 * de rest schuift elke ronde één plek door. Iedereen speelt precies één keer tegen iedereen.
 * Bij een oneven aantal is er een lege plek: wie daar tegenover staat, wacht die ronde.
 */
export function scheduleRound(players: readonly Id[], r: number): { pairs: [Id, Id][]; bye: Id | null } {
  const list: (Id | null)[] = players.length % 2 ? [...players, null] : [...players];
  const n = list.length;
  if (n < 2) return { pairs: [], bye: players[0] ?? null };
  const others = list.slice(1);
  const m = others.length;
  const shift = ((r % m) + m) % m;
  const rotated = [...others.slice(m - shift), ...others.slice(0, m - shift)];
  const arr = [list[0], ...rotated];
  const pairs: [Id, Id][] = [];
  let bye: Id | null = null;
  for (let i = 0; i < n / 2; i++) {
    const a = arr[i];
    const b = arr[n - 1 - i];
    if (a === null) bye = b;
    else if (b === null) bye = a;
    else pairs.push([a, b]);
  }
  return { pairs, bye };
}
