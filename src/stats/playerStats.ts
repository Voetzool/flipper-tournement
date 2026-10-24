import type { AppState, Game, Id, Tournament } from '../events/types';
import { formatOf } from '../formats';
import { areOpponents, placesOf, ranksOf } from '../events/ranks';
import { pointsFor } from '../formats/roundRobin/scoring';
import { playedGames } from '../rating/ratings';

export interface MachineStat {
  machineId: Id | null;
  played: number;
  wins: number;
  avgPosition: number;
}

export interface RivalStat {
  opponentId: Id;
  played: number;
  /** Keren dat deze speler boven de tegenstander eindigde. */
  won: number;
  lost: number;
}

export interface RecentGame {
  game: Game;
  tournament: Tournament;
  position: number;
  size: number;
  points: number;
}

export interface PlayerStats {
  games: number;
  wins: number;
  winPct: number;
  avgPosition: number;
  /** Percentage tegenstanders dat je versloeg (eerlijk te vergelijken bij verschillende groepsgroottes). */
  beatenPct: number;
  tournaments: number;
  tournamentWins: number;
  podiums: number;
  machines: MachineStat[];
  rivals: RivalStat[];
  recent: RecentGame[];
}

export function playerStats(state: AppState, playerId: Id): PlayerStats {
  let games = 0;
  let wins = 0;
  let posSum = 0;
  let beaten = 0;
  let faced = 0;
  const machines = new Map<string, MachineStat & { posSum: number }>();
  const rivals = new Map<Id, RivalStat>();
  const recent: RecentGame[] = [];

  for (const { game, tournament } of playedGames(state)) {
    const order = game.result!;
    if (!order.includes(playerId)) continue;
    const ranks = ranksOf(game);
    const pos = ranks.get(playerId)!;
    const opponents = order.filter((o) => areOpponents(game, playerId, o));
    games++;
    if (pos === 0) wins++;
    posSum += pos + 1;
    beaten += opponents.filter((o) => ranks.get(o)! > pos).length;
    faced += opponents.length;

    const mk = game.machineId ?? '';
    const m = machines.get(mk) ?? { machineId: game.machineId, played: 0, wins: 0, avgPosition: 0, posSum: 0 };
    m.played++;
    if (pos === 0) m.wins++;
    m.posSum += pos + 1;
    machines.set(mk, m);

    for (const opp of opponents) {
      const r = rivals.get(opp) ?? { opponentId: opp, played: 0, won: 0, lost: 0 };
      r.played++;
      if (pos < ranks.get(opp)!) r.won++;
      else if (pos > ranks.get(opp)!) r.lost++;
      rivals.set(opp, r);
    }

    recent.push({
      game,
      tournament,
      position: pos + 1,
      size: placesOf(game),
      points: tournament.format === 'single' ? 0 : pointsFor(tournament.settings.pointsTable, order.length, pos),
    });
  }

  let tournaments = 0;
  let tournamentWins = 0;
  let podiums = 0;
  for (const t of state.tournaments.values()) {
    const played = t.rounds.some((r) => r.games.some((g) => g.result?.includes(playerId)));
    if (!played || t.format === 'single') continue; // losse potjes zijn geen toernooien
    tournaments++;
    if (t.status !== 'finished') continue;
    const row = formatOf(t.format).standings(t).find((r) => r.playerId === playerId);
    if (row?.rank === 1) tournamentWins++;
    if (row && row.rank <= 3) podiums++;
  }

  return {
    games,
    wins,
    winPct: games ? (wins / games) * 100 : 0,
    avgPosition: games ? posSum / games : 0,
    beatenPct: faced ? (beaten / faced) * 100 : 0,
    tournaments,
    tournamentWins,
    podiums,
    machines: [...machines.values()]
      .map(({ posSum: ps, ...m }) => ({ ...m, avgPosition: ps / m.played }))
      .sort((a, b) => b.played - a.played || a.avgPosition - b.avgPosition),
    rivals: [...rivals.values()].sort((a, b) => b.played - a.played || b.won - a.won),
    recent: recent.reverse(),
  };
}
