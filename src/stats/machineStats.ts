import type { AppState, Id } from '../events/types';
import { ranksOf } from '../events/ranks';
import { playedGames } from '../rating/ratings';

export interface MachinePlayerStat {
  playerId: Id;
  played: number;
  wins: number;
  avgPosition: number;
}

export interface MachineStats {
  games: number;
  tournaments: number;
  /** Beste spelers op deze kast: meeste winsten, dan beste gemiddelde plek. */
  players: MachinePlayerStat[];
}

export function machineStats(state: AppState, machineId: Id): MachineStats {
  const per = new Map<Id, MachinePlayerStat & { posSum: number }>();
  const tournaments = new Set<Id>();
  let games = 0;
  for (const { game, tournament } of playedGames(state)) {
    if (game.machineId !== machineId) continue;
    games++;
    tournaments.add(tournament.id);
    const ranks = ranksOf(game);
    game.result!.forEach((pid) => {
      const pos = ranks.get(pid)!;
      const s = per.get(pid) ?? { playerId: pid, played: 0, wins: 0, avgPosition: 0, posSum: 0 };
      s.played++;
      if (pos === 0) s.wins++;
      s.posSum += pos + 1;
      per.set(pid, s);
    });
  }
  return {
    games,
    tournaments: tournaments.size,
    players: [...per.values()]
      .map(({ posSum, ...s }) => ({ ...s, avgPosition: posSum / s.played }))
      .sort((a, b) => b.wins - a.wins || a.avgPosition - b.avgPosition || b.played - a.played),
  };
}
