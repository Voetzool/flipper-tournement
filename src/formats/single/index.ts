import type { Tournament } from '../../events/types';
import { ranksOf } from '../../events/ranks';
import type { StandingRow } from '../roundRobin/scoring';
import type { FormatDefinition } from '../types';

/** Losse ranked pot: één potje, geen rondes. "Stand" = de uitslag van dat potje. */
export const single: FormatDefinition = {
  id: 'single',
  label: 'Losse pot',
  nextRound: () => [],
  standings(t: Tournament): StandingRow[] {
    const game = t.rounds[0]?.games[0];
    if (!game) return [];
    const ranks = ranksOf(game);
    return game.playerIds
      .map((id) => {
        const r = ranks.get(id);
        return { playerId: id, rank: r === undefined ? 1 : r + 1, points: 0, played: r === undefined ? 0 : 1, wins: r === 0 ? 1 : 0, avgPosition: r === undefined ? 0 : r + 1 };
      })
      .sort((a, b) => a.rank - b.rank);
  },
};
