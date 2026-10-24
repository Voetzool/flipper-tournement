import type { Game, GameDraft, Id, Round, RoundRobinSettings, Tournament } from '../../events/types';
import { newId } from '../../lib/id';
import { standings as pointStandings, type StandingRow } from '../roundRobin/scoring';
import type { FormatDefinition } from '../types';
import { roundCount, scheduleRound } from './schedule';

// "Round Robin": iedereen speelt één keer 1-tegen-1 tegen iedereen. Winst = 1 punt, verlies = 0.
// Bij een gedeelde eerste plaats volgt één tie-breaker: met z'n tweeën één potje, met meer allemaal samen op
// dezelfde kast. De winnaar daarvan wint het toernooi. Tie-breakers tellen niet mee voor de punten.

export function headToHeadSettings(players: number): RoundRobinSettings {
  return { rounds: roundCount(players), maxGroupSize: 2, pointsTable: { 2: [1, 0] } };
}

const regular = (t: Pick<Tournament, 'rounds'>) => t.rounds.filter((r) => !r.games.some((g) => g.tiebreak));

export function isTiebreakRound(round: Round | undefined) {
  return !!round?.games.some((g) => g.tiebreak);
}

/** Wie wacht deze ronde (alleen bij een oneven aantal spelers). */
export function waitingPlayers(t: Pick<Tournament, 'playerIds'>, round: Round): Id[] {
  if (isTiebreakRound(round)) return [];
  const playing = new Set(round.games.flatMap((g) => g.playerIds));
  return t.playerIds.filter((p) => !playing.has(p));
}

/** Stand op punten alleen (zonder tie-breakers). Gelijke punten = gelijke rang. */
function pointsOnly(t: Tournament): StandingRow[] {
  const base = pointStandings({ ...t, rounds: regular(t) });
  const rows = base.slice().sort((a, b) => b.points - a.points);
  rows.forEach((r, i) => (r.rank = i > 0 && rows[i - 1].points === r.points ? rows[i - 1].rank : i + 1));
  return rows;
}

/** Spelers die een tie-breaker moeten spelen: gedeelde eerste plaats na alle rondes (anders leeg). */
export function tiebreakPlayers(t: Tournament): Id[] {
  if (regular(t).length < t.settings.rounds) return [];
  if (!regular(t).every((r) => r.games.every((g) => g.result))) return [];
  const top = pointsOnly(t).filter((r) => r.rank === 1);
  return top.length > 1 ? top.map((r) => r.playerId) : [];
}

export function tiebreakGame(t: Tournament): Game | undefined {
  return t.rounds.flatMap((r) => r.games).find((g) => g.tiebreak);
}

/** Kasten verdelen over de potjes van een ronde: elke kast één keer, liefst een kast die beide spelers nog niet speelden. */
function assignMachines(pairs: [Id, Id][], machineIds: Id[], history: GameDraft[]): (Id | null)[] {
  const played = new Map<string, number>();
  const use = new Map<Id, number>();
  for (const g of history) {
    if (!g.machineId) continue;
    use.set(g.machineId, (use.get(g.machineId) ?? 0) + 1);
    for (const p of g.playerIds) played.set(p + '|' + g.machineId, (played.get(p + '|' + g.machineId) ?? 0) + 1);
  }
  const free = new Set(machineIds);
  return pairs.map(([a, b]) => {
    let best: Id | null = null;
    let bestCost = Infinity;
    for (const m of machineIds) {
      if (!free.has(m)) continue;
      const cost = 10 * ((played.get(a + '|' + m) ?? 0) + (played.get(b + '|' + m) ?? 0)) + (use.get(m) ?? 0);
      if (cost < bestCost) {
        bestCost = cost;
        best = m;
      }
    }
    if (best) free.delete(best);
    return best;
  });
}

export const headToHead: FormatDefinition = {
  id: 'headToHead',
  label: 'Round Robin',
  nextRound(t) {
    const done = regular(t).length;
    if (done < t.settings.rounds) {
      // De rondes van het schema mogen in elke volgorde (iedereen speelt toch 1× tegen iedereen). Kies de eerste
      // nog niet gespeelde ronde; bij vooruit indelen de ronde met de meeste potjes die meteen kunnen beginnen.
      const key = (ids: Id[]) => ids.slice().sort().join('|');
      const used = new Set(regular(t).flatMap((r) => r.games.map((g) => key(g.playerIds))));
      const busy = new Set(t.rounds.flatMap((r) => r.games.filter((g) => !g.result).flatMap((g) => g.playerIds)));
      let pairs: [Id, Id][] = [];
      let bestScore = -1;
      for (let r = 0; r < t.settings.rounds; r++) {
        const candidate = scheduleRound(t.playerIds, r).pairs;
        if (candidate.some((p) => used.has(key(p)))) continue;
        const score = candidate.filter(([a, b]) => !busy.has(a) && !busy.has(b)).length;
        if (score > bestScore) {
          bestScore = score;
          pairs = candidate;
        }
      }
      const machines = assignMachines(pairs, t.machineIds, t.rounds.flatMap((r) => r.games));
      return pairs.map((pair, i) => ({ id: newId(), machineId: machines[i], playerIds: [...pair] }));
    }
    const tied = tiebreakPlayers(t as Tournament);
    if (!tied.length || tiebreakGame(t as Tournament)) return [];
    return [{ id: newId(), machineId: t.machineIds[0] ?? null, playerIds: tied, tiebreak: true }];
  },
  standings(t) {
    const rows = pointsOnly(t);
    const tb = tiebreakGame(t);
    if (!tb?.result) return rows;
    // Tie-breaker beslist de volgorde binnen de gedeelde eerste plaats.
    const pos = new Map(tb.result.map((id, i) => [id, i]));
    const tied = rows.filter((r) => pos.has(r.playerId)).sort((a, b) => pos.get(a.playerId)! - pos.get(b.playerId)!);
    tied.forEach((r, i) => {
      r.rank = i + 1;
      if (i === 0) r.note = 'wint tie-breaker';
    });
    return [...tied, ...rows.filter((r) => !pos.has(r.playerId))];
  },
};
