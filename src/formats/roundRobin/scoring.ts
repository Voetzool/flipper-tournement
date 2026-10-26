import { clone } from '../../lib/clone';
import type { Id, RoundRobinSettings, Tournament } from '../../events/types';

export const DEFAULT_POINTS: Record<number, number[]> = {
  4: [7, 5, 3, 1],
  3: [7, 4, 1],
  2: [7, 1],
};

export function defaultSettings(): RoundRobinSettings {
  return { rounds: 5, maxGroupSize: 4, pointsTable: clone(DEFAULT_POINTS) };
}

/** Punten voor plek `position` (0 = eerste) in een groep van `size` spelers. */
export function pointsFor(table: Record<number, number[]>, size: number, position: number): number {
  const row = table[size] ?? table[Math.min(4, Math.max(2, size))] ?? [];
  return row[position] ?? 0;
}

export interface StandingRow {
  playerId: Id;
  rank: number;
  points: number;
  played: number;
  wins: number;
  /** Gemiddelde plek (1 = altijd eerste). */
  avgPosition: number;
  /** Extra toelichting, bijv. "wint tie-breaker". */
  note?: string;
}

/** Live stand: punten ↓, dan aantal overwinningen ↓, dan gemiddelde plek ↑. Gelijke stand = gelijke rang. */
export function standings(t: Tournament): StandingRow[] {
  const rows = new Map<Id, StandingRow & { posSum: number }>();
  const row = (id: Id) => {
    let r = rows.get(id);
    if (!r) {
      r = { playerId: id, rank: 0, points: 0, played: 0, wins: 0, avgPosition: 0, posSum: 0 };
      rows.set(id, r);
    }
    return r;
  };
  for (const id of t.playerIds) row(id);
  for (const round of t.rounds) {
    for (const g of round.games) {
      if (!g.result) continue;
      g.result.forEach((pid, pos) => {
        const r = row(pid);
        r.points += pointsFor(t.settings.pointsTable, g.result!.length, pos);
        r.played += 1;
        r.posSum += pos + 1;
        if (pos === 0) r.wins += 1;
      });
    }
  }
  const list = [...rows.values()].map(({ posSum, ...r }) => ({
    ...r,
    avgPosition: r.played ? posSum / r.played : 0,
  }));
  const cmp = (a: StandingRow, b: StandingRow) =>
    b.points - a.points || b.wins - a.wins || (a.avgPosition || 99) - (b.avgPosition || 99);
  list.sort(cmp);
  list.forEach((r, i) => {
    r.rank = i > 0 && cmp(list[i - 1], r) === 0 ? list[i - 1].rank : i + 1;
  });
  return list;
}

export function currentRound(t: Tournament) {
  return t.rounds[t.rounds.length - 1];
}

export function roundComplete(t: Tournament, index = t.rounds.length - 1): boolean {
  const r = t.rounds[index];
  return !!r && r.games.every((g) => !!g.result);
}
